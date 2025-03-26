import { Page } from "puppeteer";
import { sleep } from "@qillie/wheel-micro-service";
import { BrowserService } from "../browser/BrowserService";
import { JobRepository } from "../db/JobRepository";
import { ImageProcessor } from "../image/ImageProcessor";
import { LoggerService } from "../logging/LoggerService";
import { OcrService } from "../ocr/OcrService";
import { ConsecutivePagesResult, JobDescriptionResult, JobInfo, PageProcessResult } from "../types/JobTypes";

/**
 * 사람인 웹사이트 전용 스크래퍼
 */
export class SaraminScraper {
  private readonly logger: LoggerService;
  private readonly browserService: BrowserService;
  private readonly jobRepository: JobRepository;
  private readonly ocrService: OcrService;
  private readonly imageProcessor: ImageProcessor;

  constructor(
    logger: LoggerService,
    browserService: BrowserService,
    jobRepository: JobRepository,
    ocrService: OcrService,
    imageProcessor: ImageProcessor
  ) {
    this.logger = logger;
    this.browserService = browserService;
    this.jobRepository = jobRepository;
    this.ocrService = ocrService;
    this.imageProcessor = imageProcessor;
  }

  /**
   * 사람인 페이지 URL 생성
   */
  public buildPageUrl(pageNum: number): string {
    return `https://www.saramin.co.kr/zf_user/jobs/list/domestic?page=${pageNum}&loc_mcd=101000%2C102000&cat_kewd=81%2C2248%2C80%2C82%2C83%2C2239%2C109%2C107%2C106%2C105%2C108%2C104%2C84%2C87%2C2247%2C86%2C89&exp_cd=1%2C2&exp_max=2&exp_none=y&edu_min=8&edu_max=12&edu_none=y&search_optional_item=y&search_done=y&panel_count=y&preview=y&isAjaxRequest=0&page_count=50&sort=RD&type=domestic&is_param=1&isSearchResultEmpty=1&isSectionHome=0&searchParamCount=8`;
  }

  /**
   * 채용 목록 페이지 처리
   */
  public async processListPage(
    page: Page, 
    pageNum: number, 
    waitTime: number
  ): Promise<PageProcessResult> {
    const pageJobs: JobInfo[] = [];
    let shouldContinue = true;
    
    try {
      const pageUrl = this.buildPageUrl(pageNum);
      
      // 페이지 로드
      const loadSuccess = await this.browserService.loadPageWithRetry(page, pageUrl, {
        waitForSelector: ".box_item",
        waitTime
      });
      
      if (!loadSuccess) {
        return { jobs: [], shouldContinue: false };
      }
  
      // 채용 공고 링크 추출
      const links = await this.extractJobLinks(page);
      this.logger.logVerbose(`페이지 ${pageNum}: ${links.length}개 채용 공고 발견`);
      
      // 링크가 없으면 즉시 반환
      if (links.length === 0) {
        this.logger.log(`페이지 ${pageNum}에서 채용 공고를 찾을 수 없습니다.`, 'warning');
        return { jobs: [], shouldContinue: false };
      }
      
      // 각 채용 공고 URL 생성
      const urlsToCheck = links.map(link => `https://www.saramin.co.kr${link}`);
      
      // 기존 URL 중복 확인
      const existingUrls = await this.jobRepository.checkExistingUrls(urlsToCheck);
      this.logger.logVerbose(`${existingUrls.length}개 중복 채용 공고 발견`);
      
      // 중복 체크
      const duplicatesInThisPage = existingUrls.length;
      if (duplicatesInThisPage >= 5 && duplicatesInThisPage === links.length) {
        this.logger.log(`모든 채용 공고(${duplicatesInThisPage}개)가 이미 수집되었습니다`, 'warning');
        shouldContinue = true; // 다음 페이지 계속 진행
        return { jobs: pageJobs, shouldContinue };
      }
      
      // 새 URL 필터링 및 처리
      const newUrls = urlsToCheck.filter(url => !existingUrls.includes(url));
      
      if (newUrls.length > 0) {
        for (let i = 0; i < newUrls.length; i++) {
          try {
            const fullUrl = newUrls[i];
            this.logger.log(`처리 중: ${i+1}/${newUrls.length} - ${fullUrl}`, 'info');
            
            const randomWaitTime = Math.floor(Math.random() * 2001) + 4000;
            const jobInfo = await this.extractJobDetails(page, fullUrl, randomWaitTime);
            
            if (jobInfo) {
              jobInfo.url = fullUrl;
              pageJobs.push(jobInfo);
              await this.jobRepository.saveJob(jobInfo, fullUrl);
            }
          } catch (error) {
            this.logger.log(`채용 상세 정보 추출 오류: ${error}`, 'error');
            continue;
          }
        }
      } else {
        this.logger.log(`새로운 채용 공고 없음`, 'info');
      }
      
    } catch (error) {
      this.logger.log(`페이지 ${pageNum} 처리 중 오류: ${error}`, 'error');
    }
    
    return { jobs: pageJobs, shouldContinue };
  }

  /**
   * 페이지에서 채용 링크 추출
   */
  private async extractJobLinks(page: Page): Promise<string[]> {
    const links = await this.browserService.evaluate<string[]>(page, () => {
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
    
    return links || [];
  }

  /**
   * 채용 상세 페이지에서 상세 정보 추출
   */
  public async extractJobDetails(page: Page, url: string, waitTime: number): Promise<JobInfo | null> {
    const maxRetries = 2;
    let retryCount = 0;
    
    while (retryCount <= maxRetries) {
      try {
        // 상세 페이지 로드
        const loadSuccess = await this.browserService.loadPageWithRetry(page, url, {
          waitForSelector: "section[class^='jview jview-0-']",
          waitTime
        });
        
        if (!loadSuccess) {
          throw new Error("페이지 로드 실패");
        }
        
        // 기본 채용 정보 추출
        const jobInfo = await this.browserService.evaluate<JobInfo | null>(page, () => {
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

        if (!jobInfo) {
          throw new Error("채용 정보 추출 실패");
        }

        // 상세 설명 추출
        const jobDescriptionResult = await this.extractJobDescription(page);
        
        if (jobDescriptionResult) {
          jobInfo.jobDescription = jobDescriptionResult.content;
          jobInfo.descriptionType = jobDescriptionResult.type;
        } else {
          this.logger.log(`채용 상세 설명을 찾을 수 없음`, 'warning');
        }

        return jobInfo;

      } catch (error) {
        retryCount++;
        const isTimeout = error instanceof Error && error.name === 'TimeoutError';
        this.logger.log(`${url} 처리 실패 (${retryCount}/${maxRetries}): ${isTimeout ? '타임아웃 발생' : error}`, 'warning');
        
        if (retryCount <= maxRetries) {
          this.logger.log(`3초 후 재시도...`, 'info');
          await sleep(3000);
        } else {
          this.logger.log(`최대 재시도 횟수 초과`, 'error');
          return null;
        }
      }
    }
    
    return null;
  }

  /**
   * 채용 상세 페이지에서 직무 설명 추출
   */
  public async extractJobDescription(page: Page): Promise<JobDescriptionResult | null> {
    try {
      const hasDetailSection = await this.browserService.evaluate<boolean>(page, () => {
        return document.querySelector('.jv_cont.jv_detail') !== null;
      });

      if (!hasDetailSection) {
        this.logger.logVerbose('상세 섹션이 존재하지 않음');
        return null;
      }

      const hasIframe = await this.browserService.evaluate<boolean>(page, () => {
        const detailSection = document.querySelector('.jv_cont.jv_detail');
        return detailSection?.querySelector('iframe') !== null;
      });

      // iframe 콘텐츠 처리
      if (hasIframe) {
        return await this.handleIframeContent(page);
      }
      
      // 직접 텍스트 추출
      const directContent = await this.browserService.evaluate<string>(page, () => {
        const detailSection = document.querySelector('.jv_cont.jv_detail');
        return detailSection?.textContent?.trim() || '';
      }) || '';
      
      // 추출된 직무 설명 텍스트 정리
      const cleanedContent = this.ocrService.cleanJobDescription(directContent);
      // 텍스트 개선
      const improvedContent = await this.ocrService.improveTextWithMistral(cleanedContent);
      
      return {
        content: improvedContent,
        type: 'text'
      };
    } catch (error) {
      this.logger.log('채용 상세 설명 추출 중 오류: ' + error, 'error');
      return null;
    }
  }

  /**
   * iframe 콘텐츠 추출 처리
   */
  private async handleIframeContent(page: Page): Promise<JobDescriptionResult | null> {
    const iframeSrc = await this.browserService.evaluate<string>(page, () => {
      const iframe = document.querySelector('.jv_cont.jv_detail iframe');
      return iframe?.getAttribute('src') || '';
    }) || '';
    
    if (!iframeSrc) return null;
    
    const fullIframeSrc = iframeSrc.startsWith('http') ? 
      iframeSrc : `https://www.saramin.co.kr${iframeSrc}`;
    
    const iframePage = await page.browser().newPage();
    
    try {
      await this.browserService.loadPageWithRetry(iframePage, fullIframeSrc, {
        waitTime: 2000
      });
      
      const isImageContent = await this.browserService.evaluate<boolean>(iframePage, () => {
        const imageElements = document.querySelectorAll('img[src*=".jpg"], img[src*=".jpeg"], img[src*=".png"]');
        return imageElements.length > 0;
      }) || false;
      
      let ocrContent = '';
      
      // 이미지가 있으면 OCR 처리
      if (isImageContent) {
        const result = await this.processOCR(iframePage);
        if (result) {
          ocrContent = result.content;
        }
      }

      // 텍스트 내용 추출
      const textContent = await this.browserService.evaluate<string>(iframePage, () => {
        const contentElement = document.querySelector('body');
        return contentElement?.innerText || '';
      }) || '';
      
      // 추출된 텍스트 정리
      const cleanedTextContent = this.ocrService.cleanJobDescription(textContent);

      let finalContent = cleanedTextContent;
      let contentType = 'text';

      // OCR 결과가 있으면 병합
      if (ocrContent) {
        finalContent = `${ocrContent}\n${cleanedTextContent}`;
        contentType = 'ocr+text';
      }

      // 최종 텍스트 개선
      const improvedFinalContent = await this.ocrService.improveTextWithMistral(finalContent);
      
      return {
        content: improvedFinalContent,
        type: contentType
      };
    } catch (error) {
      this.logger.log('iframe 콘텐츠 처리 중 오류:' + error, 'error');
      return null;
    } finally {
      await iframePage.close();
    }
  }

  /**
   * 페이지 내 이미지 OCR 처리
   */
  private async processOCR(page: Page): Promise<JobDescriptionResult | null> {
    try {
      // 이미지 URL 추출
      const imageUrls = await this.browserService.evaluate<string[]>(page, () => {
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
      }) || [];

      // 이미지가 없으면 스크린샷 사용
      if (!imageUrls.length) {
        this.logger.log('OCR 처리를 위한 이미지를 찾을 수 없음', 'warning');
        return await this.processPageScreenshot(page);
      }
      
      // 각 이미지 처리
      let allText = '';
      for (let i = 0; i < imageUrls.length; i++) {
        try {
          const imageText = await this.ocrService.processImageWithOCR(imageUrls[i]);
          if (imageText) {
            const cleanedImageText = this.ocrService.cleanJobDescription(imageText);
            allText += cleanedImageText + '\n\n';
          }
        } catch (error) {
          this.logger.log(`이미지 ${i + 1} 처리 중 오류: ${error}`, 'error');
        }
      }

      return {
        content: allText.trim(),
        type: 'ocr'
      };
    } catch (error) {
      this.logger.log('OCR 처리 중 오류: ' + error, 'error');
      return null;
    }
  }

  /**
   * 이미지가 없을 때 페이지 스크린샷 OCR 처리
   */
  private async processPageScreenshot(page: Page): Promise<JobDescriptionResult | null> {
    try {
      const dataUrl = await this.imageProcessor.takePageScreenshot(page);
      const ocrResult = await this.ocrService.processImageWithOCR(dataUrl);
      
      return {
        content: ocrResult,
        type: 'ocr'
      };
    } catch (error) {
      this.logger.log('페이지 스크린샷 처리 중 오류: ' + error, 'error');
      return null;
    }
  }

  /**
   * 연속된 빈 페이지나 중복 페이지 처리
   */
  public async handleConsecutivePages(
    pageJobs: JobInfo[],
    emptyCounts: number,
    duplicateCounts: number
  ): Promise<ConsecutivePagesResult> {
    // 빈 페이지 처리
    let newEmptyCounts = pageJobs.length === 0 ? emptyCounts + 1 : 0;
    if (newEmptyCounts > 0) {
      this.logger.log(`연속 ${newEmptyCounts}페이지에서 채용 공고를 찾지 못했습니다.`, 'warning');
      
      if (newEmptyCounts >= 3) {
        this.logger.log(`연속 ${newEmptyCounts}페이지에서 데이터가 없어 스크래핑을 종료합니다.`, 'warning');
        return { 
          emptyCounts: newEmptyCounts, 
          duplicateCounts, 
          shouldContinue: false 
        };
      }
    }
    
    // 중복 페이지 처리 (빈 페이지가 아닌 경우에만)
    let newDuplicateCounts = duplicateCounts;
    if (pageJobs.length > 0) {
      const allExisting = await this.jobRepository.checkExistingUrls(pageJobs.map(job => job.url || ''));
      
      if (allExisting.length === pageJobs.length) {
        newDuplicateCounts++;
        this.logger.log(`연속 ${newDuplicateCounts}페이지에서 모든 채용 공고가 중복되었습니다.`, 'warning');
        
        if (newDuplicateCounts >= 3) {
          this.logger.log(`연속 ${newDuplicateCounts}페이지 모두 중복으로 스크래핑을 종료합니다.`, 'warning');
          return {
            emptyCounts: newEmptyCounts,
            duplicateCounts: newDuplicateCounts,
            shouldContinue: false
          };
        }
      } else {
        newDuplicateCounts = 0;
      }
    }
    
    return { 
      emptyCounts: newEmptyCounts, 
      duplicateCounts: newDuplicateCounts, 
      shouldContinue: true 
    };
  }
}
