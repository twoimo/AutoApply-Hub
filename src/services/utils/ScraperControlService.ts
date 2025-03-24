import { ScraperServiceABC, sleep } from "@qillie/wheel-micro-service";
import _ from "lodash";
import sequelize from "sequelize";
import axios from "axios";
import puppeteer, { Browser, Page } from "puppeteer";
import CompanyRecruitmentTable from "../../models/main/CompanyRecruitmentTable";
import { Mistral } from '@mistralai/mistralai';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import sharp from 'sharp';

// 환경 변수 로드
dotenv.config();

// 핵심 인터페이스 정의
interface JobInfo {
  companyName: string;
  jobTitle: string;
  jobLocation: string;
  jobType: string;
  jobSalary: string;
  deadline: string;
  employmentType: string;
  url?: string;
  companyType?: string;
  jobDescription?: string;
  descriptionType?: string;
}

interface ScraperConfig {
  startPage?: number;
  endPage?: number;
  headless?: boolean;
  waitTime?: number;
}

/**
 * 사람인 채용 공고 스크래퍼 서비스
 * 사람인 웹사이트에서 채용 공고를 스크래핑, 처리 및 저장하는 역할 담당
 */
export default class ScraperControlService extends ScraperServiceABC {
  // 기본 설정
  private defaultConfig: ScraperConfig = {
    startPage: 1,
    endPage: Number.MAX_SAFE_INTEGER, // 데이터가 없을 때까지 계속 진행
    headless: false,
    waitTime: Math.floor(Math.random() * 2001) + 4000
  };

  // Mistral AI 클라이언트 (OCR 처리용)
  private mistralClient: Mistral | null = null;
  
  // 이미지 처리를 위한 임시 디렉토리
  private readonly tempDir = path.join(process.cwd(), 'temp');

  constructor() {
    super([]);
    this.initializeMistralClient();
    this.ensureTempDirectory();
  }

  /**
   * OCR 처리를 위한 Mistral AI 클라이언트 초기화
   */
  private initializeMistralClient(): void {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (apiKey) {
      try {
        this.mistralClient = new Mistral({ apiKey });
        console.log('Mistral AI API 클라이언트 초기화 완료');
      } catch (error) {
        console.error('Mistral AI API 클라이언트 초기화 실패:', error);
        this.mistralClient = null;
      }
    }
  }

  /**
   * 임시 디렉토리 존재 확인
   */
  private ensureTempDirectory(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir);
    }
  }

  /**
   * 사람인 채용 공고 스크래핑 시작
   */
  public async openSaramin(config: ScraperConfig = {}): Promise<JobInfo[]> {
    // 기본값과 함께 설정 적용
    const settings = this.applyConfiguration(config);
    const { startPage, endPage, headless, waitTime } = settings;
    
    let browser: Browser | null = null;
    const collectedJobs: JobInfo[] = [];
    
    console.log(`\n사람인 채용 정보 스크래핑 시작: 페이지 ${startPage}부터 데이터가 없을 때까지`);
    const startTime = Date.now();
    
    let consecutiveDuplicates = 0;
    let continueScrapping = true;
  
    try {
      browser = await this.initializeBrowser(headless);
      const page = await browser.newPage();
      page.setDefaultTimeout(30000);
  
      for (let i = startPage; i <= endPage && continueScrapping; i++) {
        console.log(`\n페이지 ${i} 스크래핑 중...`);
        
        const pageJobs = await this.processSaraminPage(page, i, waitTime, consecutiveDuplicates, continueScrapping);
        
        if (pageJobs.length === 0) {
          console.log(`\n페이지 ${i}에서 채용 공고를 찾을 수 없습니다. 스크래핑을 종료합니다.`);
          break;
        }
        
        // 연속된 중복 확인
        const allExisting = await this.checkExistingUrls(pageJobs.map(job => job.url || ''));
        if (allExisting.length === pageJobs.length) {
          consecutiveDuplicates++;
          console.log(`\n연속 ${consecutiveDuplicates}페이지에서 모든 채용 공고가 중복되었습니다.`);
          
          if (consecutiveDuplicates >= 3) {
            console.log(`\n연속 ${consecutiveDuplicates}페이지에서 중복 발견: 스크래핑을 종료합니다.`);
            break;
          }
        } else {
          consecutiveDuplicates = 0;
        }
        
        collectedJobs.push(...pageJobs);
        console.log(`페이지 ${i} 완료: ${pageJobs.length}개 채용 공고 추출됨`);
      }
      
      this.printSummary(collectedJobs);
      
      const elapsedTime = (Date.now() - startTime) / 1000;
      console.log(`총 소요 시간: ${elapsedTime.toFixed(2)}초`);
      
      return collectedJobs;
    } catch (error) {
      console.error(`스크래핑 중 오류 발생:`, error);
      return collectedJobs;
    } finally {
      if (browser) {
        await browser.close();
        console.log(`브라우저 종료 및 스크래핑 완료`);
      }
    }
  }

  /**
   * 사용자 설정과 기본 설정 결합
   */
  private applyConfiguration(config: ScraperConfig): Required<ScraperConfig> {
    return {
      startPage: config.startPage ?? this.defaultConfig.startPage!,
      endPage: config.endPage ?? this.defaultConfig.endPage!,
      headless: config.headless ?? this.defaultConfig.headless!,
      waitTime: config.waitTime ?? this.defaultConfig.waitTime!
    };
  }
  
  /**
   * 최적화된 설정으로 Puppeteer 브라우저 초기화
   */
  private async initializeBrowser(headless: boolean = false): Promise<Browser> {
    return puppeteer.launch({
      headless,
      defaultViewport: null,
      args: [
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process",
        "--allow-running-insecure-content",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage"
      ],
    });
  }

  /**
   * 단일 사람인 채용 리스팅 페이지 처리
   */
  private async processSaraminPage(
    page: Page, 
    pageNum: number, 
    waitTime: number,
    consecutiveDuplicates: number,
    continueScrapping: boolean
  ): Promise<JobInfo[]> {
    const pageJobs: JobInfo[] = [];
    
    try {
      const pageUrl = this.buildSaraminPageUrl(pageNum);
      await page.goto(pageUrl, { waitUntil: "networkidle2" });
      await sleep(waitTime);
  
      const links = await this.extractJobLinks(page);
      console.log(`페이지 ${pageNum}: ${links.length}개 채용 공고 발견`);
      
      const urlsToCheck = links.map(link => `https://www.saramin.co.kr${link}`);
      const existingUrls = await this.checkExistingUrls(urlsToCheck);
      
      console.log(`${existingUrls.length}개 중복 채용 공고 발견`);
      
      const duplicatesInThisPage = existingUrls.length;
      
      if (duplicatesInThisPage >= 5 && duplicatesInThisPage === links.length) {
        console.log(`\n모든 채용 공고(${duplicatesInThisPage}개)가 이미 수집되었습니다`);
        consecutiveDuplicates++;
        
        if (consecutiveDuplicates >= 3) {
          console.log(`\n연속 ${consecutiveDuplicates}페이지에서 중복 발견`);
          continueScrapping = false;
          return pageJobs;
        }
      } else {
        consecutiveDuplicates = 0;
      }
      
      const newUrls = urlsToCheck.filter(url => !existingUrls.includes(url));
      
      for (const fullUrl of newUrls) {
        try {
          const randomWaitTime = Math.floor(Math.random() * 2001) + 4000;
          const jobInfo = await this.extractJobDetails(page, fullUrl, randomWaitTime);
          
          if (jobInfo) {
            jobInfo.url = fullUrl;
            pageJobs.push(jobInfo);
            await this.saveJobToDatabase(jobInfo, fullUrl);
          }
        } catch (error) {
          console.error(`채용 상세 정보 추출 오류: ${error}`);
          continue;
        }
      }
      
    } catch (error) {
      console.error(`페이지 ${pageNum} 처리 중 오류: ${error}`);
    }
    
    return pageJobs;
  }

  /**
   * 채용 정보를 데이터베이스에 저장
   */
  private async saveJobToDatabase(jobInfo: JobInfo, url: string): Promise<void> {
    await CompanyRecruitmentTable.create({
      company_name: jobInfo.companyName,
      job_title: jobInfo.jobTitle,
      job_location: jobInfo.jobLocation,
      job_type: jobInfo.jobType,
      job_salary: jobInfo.jobSalary,
      deadline: jobInfo.deadline,
      employment_type: jobInfo.employmentType || "",
      job_url: url,
      company_type: jobInfo.companyType || "",
      job_description: jobInfo.jobDescription || "",
      description_type: jobInfo.descriptionType || "text",
      scraped_at: new Date(),
      is_applied: false
    });

    this.logJobInfo(jobInfo, url);
  }

  /**
   * 채용 정보를 콘솔에 기록
   */
  private logJobInfo(jobInfo: JobInfo, url: string): void {
    console.log(`\n채용 정보 추출 성공`);
    console.log(`------------------------------`);
    console.log(`회사: ${jobInfo.companyName}`);
    console.log(`제목: ${jobInfo.jobTitle}`);
    console.log(`위치: ${jobInfo.jobLocation}`);
    console.log(`경력: ${jobInfo.jobType}`);
    console.log(`급여: ${jobInfo.jobSalary}`);
    console.log(`고용 형태: ${jobInfo.employmentType || "명시되지 않음"}`);
    console.log(`마감일: ${jobInfo.deadline}`);
    console.log(`회사 유형: ${jobInfo.companyType || "명시되지 않음"}`);
    console.log(`원본 URL: ${url}`);
    console.log(`상세 정보: ${jobInfo.jobDescription ? '추출됨' : '없음'} (${jobInfo.descriptionType || 'N/A'})`);
    console.log(`------------------------------\n`);
  }

  /**
   * 적절한 매개변수를 포함한 사람인 페이지 URL 생성
   */
  private buildSaraminPageUrl(pageNum: number): string {
    return `https://www.saramin.co.kr/zf_user/jobs/list/domestic?page=${pageNum}&loc_mcd=101000%2C102000&cat_kewd=81%2C2248%2C80%2C82%2C83%2C2239%2C109%2C107%2C106%2C105%2C108%2C104%2C84%2C87%2C2247%2C86%2C89&exp_cd=1%2C2&exp_max=2&exp_none=y&edu_min=8&edu_max=12&edu_none=y&search_optional_item=y&search_done=y&panel_count=y&preview=y&isAjaxRequest=0&page_count=50&sort=RL&type=domestic&is_param=1&isSearchResultEmpty=1&isSectionHome=0&searchParamCount=8#searchTitle`;
  }

  /**
   * 페이지에서 채용 링크 추출
   */
  private async extractJobLinks(page: Page): Promise<string[]> {
    return page.evaluate(() => {
      const linkList: string[] = [];
      const boxItems = document.querySelectorAll(".box_item");

      boxItems.forEach((item) => {
        const notificationInfo = item.querySelector(".notification_info");
        if (notificationInfo) {
          const linkElement = notificationInfo.querySelector("a");
          if (linkElement && linkElement.getAttribute("href")) {
            linkList.push(linkElement.getAttribute("href") || "");
          }
        }
      });

      return linkList;
    });
  }

  /**
   * 채용 상세 페이지에서 상세 정보 추출
   */
  private async extractJobDetails(page: Page, url: string, waitTime: number): Promise<JobInfo | null> {
    try {
      console.log(`\n=============================`);
      console.log(`채용 상세 정보 처리 중: ${url}`);
      console.log(`=============================`);
      
      await page.goto(url, { waitUntil: "networkidle2" });
      await sleep(waitTime);

      const jobInfo = await page.evaluate(() => {
        const jviewSectionSelector = "section[class^='jview jview-0-']";
        const jviewSection = document.querySelector(jviewSectionSelector);
        
        if (!jviewSection) return null;

        const getTextContent = (selector: string): string => {
          const element = jviewSection.querySelector(selector);
          return element ? element.textContent?.trim() || "" : "";
        };

        const extractDeadline = (): string => {
          const allElements = Array.from(jviewSection.querySelectorAll("*"));
          
          for (const el of allElements) {
            const text = el.textContent || "";
            if (text.includes("마감일") || text.includes("접수기간") || 
                text.includes("모집기간") || text.includes("공고기간")) {
              const datePattern = /\d{4}[-./]\d{1,2}[-./]\d{1,2}/g;
              const timePattern = /\d{1,2}:\d{2}/g;
              
              const dateMatches = text.match(datePattern);
              const timeMatches = text.match(timePattern);
              
              if (dateMatches) {
                return timeMatches 
                  ? `${dateMatches[0]} ${timeMatches[0]}`
                  : dateMatches[0];
              }
            }
          }
          return "";
        };

        const extractInfoFromColumns = (): Record<string, string> => {
          const result: Record<string, string> = {};
          const dlElements = jviewSection.querySelectorAll("dl");
          
          dlElements.forEach((dl) => {
            const title = dl.querySelector("dt")?.textContent?.trim() || "";
            const value = dl.querySelector("dd")?.textContent?.trim() || "";
            if (title && value) result[title] = value;
          });
          
          return result;
        };
        
        const extractCompanyType = (): string => {
          const companyInfoArea = jviewSection.querySelector(".info_area");
          if (!companyInfoArea) return "";
          
          const dlElements = companyInfoArea.querySelectorAll("dl");
          for (const dl of Array.from(dlElements)) {
            const dt = dl.querySelector("dt");
            if (dt && dt.textContent && dt.textContent.trim() === "기업형태") {
              const dd = dl.querySelector("dd");
              if (dd && dd.getAttribute("title")) {
                return dd.getAttribute("title") || "";
              }
              else if (dd) {
                return dd.textContent?.trim() || "";
              }
              return "";
            }
          }
          return "";
        };
        
        const columnInfo = extractInfoFromColumns();
        
        const companyName = getTextContent(".title_inner .company") || getTextContent(".company_name") || getTextContent(".corp_name");
        const jobTitle = getTextContent(".job_tit") || getTextContent("h1.tit_job");
        const jobLocation = columnInfo["근무지역"]?.replace(/지도/g, "").trim() || "";
        
        let deadline = "";
        
        const infoDeadline = jviewSection.querySelector(".info_period");
        if (infoDeadline) {
          const endDt = infoDeadline.querySelector("dt.end");
          if (endDt && endDt.textContent?.includes("마감일")) {
            const endDd = endDt.nextElementSibling;
            if (endDd && endDd.tagName.toLowerCase() === "dd") {
              deadline = endDd.textContent?.trim() || "";
            }
          }
        }
        
        if (!deadline) {
          deadline = extractDeadline();
        }
        
        let jobSalary = columnInfo["급여"] || columnInfo["급여조건"] || "";
        if (jobSalary) {
          jobSalary = jobSalary
            .split("상세보기")[0]
            .split("최저임금")[0]
            .trim();
          
          const hourPattern = /\(주 \d+시간\)/;
          const match = jobSalary.match(hourPattern);
          if (match) {
            const index = jobSalary.indexOf(match[0]) + match[0].length;
            jobSalary = jobSalary.substring(0, index).trim();
          }
        }
        
        const employmentType = columnInfo["근무형태"] || columnInfo["고용형태"] || "";
        const companyType = extractCompanyType();
        
        return {
          companyName,
          jobTitle,
          jobLocation,
          jobType: columnInfo["경력"] || columnInfo["경력조건"] || "",
          jobSalary,
          deadline,
          employmentType,
          companyType,
          jobDescription: "",
          descriptionType: ""
        };
      });

      if (jobInfo) {
        const jobDescriptionResult = await this.extractJobDescription(page);
        
        if (jobDescriptionResult) {
          jobInfo.jobDescription = jobDescriptionResult.content;
          jobInfo.descriptionType = jobDescriptionResult.type;
          console.log(`채용 상세 설명 추출 성공: ${jobDescriptionResult.type} 방식`);
        } else {
          console.log(`채용 상세 설명을 찾을 수 없음`);
        }
      } else {
        console.log(`채용 정보 추출 실패: 정보를 찾을 수 없음`);
      }

      return jobInfo;

    } catch (error) {
      console.error(`${url}에서 채용 정보 추출 실패: ${error}`);
      return null;
    }
  }

  /**
   * 채용 상세 페이지에서 직무 설명 추출
   */
  private async extractJobDescription(page: Page): Promise<{ content: string; type: string } | null> {
    try {
      const hasDetailSection = await page.evaluate(() => {
        return document.querySelector('.jv_cont.jv_detail') !== null;
      });

      if (!hasDetailSection) {
        console.log('상세 섹션이 존재하지 않음');
        return null;
      }

      const hasIframe = await page.evaluate(() => {
        const detailSection = document.querySelector('.jv_cont.jv_detail');
        return detailSection?.querySelector('iframe') !== null;
      });

      if (hasIframe) {
        return await this.handleIframeContent(page);
      }
      
      const directContent = await page.evaluate(() => {
        const detailSection = document.querySelector('.jv_cont.jv_detail');
        return detailSection?.textContent?.trim() || '';
      });
      
      return {
        content: directContent,
        type: 'text'
      };
    } catch (error) {
      console.error('채용 상세 설명 추출 중 오류:', error);
      return null;
    }
  }

  /**
   * iframe 콘텐츠 추출 처리
   */
  private async handleIframeContent(page: Page): Promise<{ content: string; type: string } | null> {
    const iframeSrc = await page.evaluate(() => {
      const iframe = document.querySelector('.jv_cont.jv_detail iframe');
      return iframe?.getAttribute('src') || '';
    });
    
    if (!iframeSrc) return null;
    
    const fullIframeSrc = iframeSrc.startsWith('http') ? 
      iframeSrc : `https://www.saramin.co.kr${iframeSrc}`;
    
    const iframePage = await page.browser().newPage();
    
    try {
      await iframePage.goto(fullIframeSrc, { waitUntil: 'networkidle2' });
      await sleep(2000);
      
      const isImageContent = await iframePage.evaluate(() => {
        const imageElements = document.querySelectorAll('img[src*=".jpg"], img[src*=".jpeg"], img[src*=".png"]');
        return imageElements.length > 0;
      });
      
      let ocrContent = '';
      if (isImageContent) {
        console.log('이미지 콘텐츠 감지: OCR 처리 시작');
        const result = await this.processOCR(iframePage);
        if (result) {
          ocrContent = result.content;
          console.log(`OCR 처리 완료 (${ocrContent.length}자)`);
        }
      }

      const textContent = await iframePage.evaluate(() => {
        const contentElement = document.querySelector('body');
        return contentElement?.innerText || '';
      });
      console.log(`텍스트 추출 완료 (${textContent.length}자)`);

      let finalContent = textContent;
      let contentType = 'text';

      if (ocrContent) {
        finalContent = `[OCR 내용]\n${ocrContent}\n\n[텍스트 내용]\n${textContent}`;
        contentType = 'ocr+text';
      }
      
      return {
        content: finalContent,
        type: contentType
      };
    } catch (error) {
      console.error('iframe 콘텐츠 처리 중 오류:', error);
      return null;
    } finally {
      await iframePage.close();
    }
  }

  /**
   * 페이지 내 이미지 OCR 처리
   */
  private async processOCR(page: Page): Promise<{ content: string; type: string } | null> {
    try {
      const imageUrls = await page.evaluate(() => {
        const images = document.querySelectorAll('img[src*=".jpg"], img[src*=".jpeg"], img[src*=".png"]');
        return Array.from(images).map(img => {
          const src = img.getAttribute('src') || '';
          if (src.startsWith('http')) {
            return src;
          } else if (src.startsWith('//')) {
            return `https:${src}`;
          } else if (src.startsWith('/')) {
            return `https://www.saramin.co.kr${src}`;
          } else {
            const baseUrl = window.location.origin;
            const path = window.location.pathname.split('/').slice(0, -1).join('/') + '/';
            return `${baseUrl}${path}${src}`;
          }
        }).filter(url => url && url.length > 0);
      });

      if (!imageUrls.length) {
        console.log('OCR 처리를 위한 이미지를 찾을 수 없음');
        return await this.processPageScreenshot(page);
      }
      
      console.log(`\nOCR 처리를 위한 이미지 ${imageUrls.length}개 발견`);

      let allText = '';
      for (let i = 0; i < imageUrls.length; i++) {
        console.log(`\n이미지 ${i + 1}/${imageUrls.length} 처리 중`);
        
        try {
          const imageText = await this.processImageWithOCR(imageUrls[i]);
          if (imageText) {
            allText += imageText + '\n\n';
            console.log(`이미지 ${i + 1} OCR 완료 (${imageText.length}자)`);
          }
        } catch (error) {
          console.error(`이미지 ${i + 1} 처리 중 오류:`, error);
        }
      }

      return {
        content: allText.trim(),
        type: 'ocr'
      };
    } catch (error) {
      console.error('OCR 처리 중 오류:', error);
      return null;
    }
  }

  /**
   * 이미지가 없을 때 페이지 스크린샷 OCR 처리
   */
  private async processPageScreenshot(page: Page): Promise<{ content: string; type: string } | null> {
    console.log('전체 페이지 스크린샷을 OCR 처리에 사용');
    const screenshotPath = path.join(this.tempDir, `${uuidv4()}.png`);
    
    try {
      await page.screenshot({ path: screenshotPath, fullPage: true });
      
      const imageBuffer = fs.readFileSync(screenshotPath);
      const base64Image = imageBuffer.toString('base64');
      const dataUrl = `data:image/png;base64,${base64Image}`;
      
      const ocrResult = await this.processImageWithOCR(dataUrl);
      return {
        content: ocrResult,
        type: 'ocr'
      };
    } catch (error) {
      console.error('페이지 스크린샷 처리 중 오류:', error);
      return null;
    } finally {
      if (fs.existsSync(screenshotPath)) {
        fs.unlinkSync(screenshotPath);
      }
    }
  }

  /**
   * 단일 이미지 OCR 처리
   */
  private async processImageWithOCR(imageUrl: string): Promise<string> {
    if (!this.mistralClient) {
      throw new Error('Mistral API 클라이언트가 초기화되지 않음');
    }

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const resizedImageUrl = await this.resizeImageIfNeeded(imageUrl);

        const ocrResponse = await this.mistralClient.ocr.process({
          model: "mistral-ocr-latest",
          document: {
            type: "image_url",
            imageUrl: resizedImageUrl,
          }
        });

        let extractedText = '';
        if (ocrResponse.pages && ocrResponse.pages.length > 0) {
          extractedText = ocrResponse.pages.map(page => page.markdown).join('\n\n');
        }

        return extractedText;
      } catch (error) {
        if ((error as any).statusCode === 429) {
          console.error(`속도 제한 오류, 재시도 중... (${attempt + 1}/${maxRetries})`);
          await sleep(2000);
          attempt++;
        } else {
          throw error;
        }
      }
    }

    throw new Error('OCR 처리 실패: 최대 재시도 횟수 초과');
  }

  /**
   * 필요시 이미지 크기 조정
   */
  private async resizeImageIfNeeded(imageUrl: string): Promise<string> {
    const maxWidth = 10000;
    const maxHeight = 10000;

    try {
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const imageBuffer = Buffer.from(response.data, 'binary');
      const image = await sharp(imageBuffer);
      const metadata = await image.metadata();

      if ((metadata.width && metadata.width > maxWidth) || (metadata.height && metadata.height > maxHeight)) {
        const resizedImageBuffer = await image.resize(maxWidth, maxHeight, {
          fit: sharp.fit.inside,
          withoutEnlargement: true
        }).toBuffer();

        const resizedImagePath = path.join(this.tempDir, `${uuidv4()}.png`);
        fs.writeFileSync(resizedImagePath, resizedImageBuffer);

        return `file://${resizedImagePath}`;
      }

      return imageUrl;
    } catch (error) {
      console.error('이미지 크기 조정 중 오류:', error);
      return imageUrl; // 크기 조정 실패 시 원본 URL 반환
    }
  }

  /**
   * URL이 데이터베이스에 이미 존재하는지 확인
   */
  private async checkExistingUrls(urls: string[]): Promise<string[]> {
    if (urls.length === 0) return [];
    
    try {
      const existingRecords = await CompanyRecruitmentTable.findAll({
        attributes: ['job_url'],
        where: {
          job_url: {
            [sequelize.Op.in]: urls
          }
        },
        raw: true
      });
      
      return existingRecords.map(record => record.job_url);
    } catch (error) {
      console.error('기존 URL 확인 중 오류:', error);
      return [];
    }
  }

  /**
   * 스크래핑 결과 요약 출력
   */
  private printSummary(jobs: JobInfo[]): void {
    console.log(`\n=================================`);
    console.log(`스크래핑 결과 요약`);
    console.log(`=================================`);
    console.log(`총 수집된 채용 공고: ${jobs.length}개`);
    
    const companyCounts: Record<string, number> = {};
    jobs.forEach(job => {
      const company = job.companyName;
      companyCounts[company] = (companyCounts[company] || 0) + 1;
    });
    
    const topCompanies = Object.entries(companyCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    if (topCompanies.length > 0) {
      console.log(`\n채용 공고가 가장 많은 회사 순위:`);
      topCompanies.forEach(([company, count], index) => {
        console.log(`   ${index + 1}. ${company}: ${count}개`);
      });
    }
    
    const jobTypeCounts: Record<string, number> = {};
    const employmentTypeCounts: Record<string, number> = {};
    
    jobs.forEach(job => {
      const jobType = job.jobType || '명시되지 않음';
      const empType = job.employmentType || '명시되지 않음';
      
      jobTypeCounts[jobType] = (jobTypeCounts[jobType] || 0) + 1;
      employmentTypeCounts[empType] = (employmentTypeCounts[empType] || 0) + 1;
    });
    
    console.log(`\n경력 요구사항별 채용 공고:`);
    Object.entries(jobTypeCounts).forEach(([type, count]) => {
      console.log(`   - ${type}: ${count}개`);
    });
    
    console.log(`\n고용 형태별 채용 공고:`);
    Object.entries(employmentTypeCounts).forEach(([type, count]) => {
      console.log(`   - ${type}: ${count}개`);
    });
    
    console.log(`=================================\n`);
  }
}
