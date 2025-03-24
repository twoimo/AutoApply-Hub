import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import axios from 'axios';
import { Mistral } from '@mistralai/mistralai';

/**
 * OCR 이미지 처리 유틸리티 클래스
 * 대용량 이미지를 분할하여 OCR API 제한(50MB) 내에서 처리하기 위한 기능 제공
 */
export class OcrImageProcessor {
  private readonly tempDir: string;
  private mistralClient: Mistral | null = null;
  private readonly maxImageSize = 45 * 1024 * 1024; // 45MB (API 한도 50MB보다 안전하게)
  private readonly maxWidth = 4000; // 최대 너비 (px)
  private readonly maxHeight = 4000; // 최대 높이 (px)
  private readonly overlapHeight = 200; // 세로 분할 시 겹치는 영역 (텍스트 잘림 방지)
  private deferTextImprovement: boolean = false; // 텍스트 개선 지연 여부

  /**
   * OCR 이미지 프로세서 초기화
   * @param mistralClient Mistral AI API 클라이언트
   * @param tempDir 임시 파일 저장 디렉토리
   * @param deferTextImprovement 텍스트 개선을 나중에 일괄 처리할지 여부
   */
  constructor(mistralClient: Mistral | null, tempDir: string, deferTextImprovement: boolean = false) {
    this.mistralClient = mistralClient;
    this.tempDir = tempDir;
    this.deferTextImprovement = deferTextImprovement;
    this.ensureTempDirectory();
  }

  /**
   * 임시 디렉토리 존재 확인
   */
  private ensureTempDirectory(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * 이미지 URL에서 OCR 처리 수행
   * @param imageUrl 이미지 URL
   * @returns OCR 처리된 텍스트
   */
  public async processImageWithOCR(imageUrl: string): Promise<string> {
    if (!this.mistralClient) {
      throw new Error('Mistral API 클라이언트가 초기화되지 않음');
    }

    try {
      // 이미지가 크기 제한을 초과하는지 확인하고 리사이징
      const resizedImageUrl = await this.resizeImageIfNeeded(imageUrl);
      
      // OCR 처리 수행
      return await this.performOcrOnImage(resizedImageUrl);
    } catch (error) {
      console.error('이미지 OCR 처리 중 오류:', error);
      throw error;
    }
  }

  /**
   * 이미지 URL에서 전체 OCR 처리 과정 수행 (분할 처리 포함)
   * @param imageUrl 이미지 URL
   * @returns OCR 처리된 텍스트
   */
  public async processFullImageWithOCR(imageUrl: string): Promise<string> {
    if (!this.mistralClient) {
      throw new Error('Mistral API 클라이언트가 초기화되지 않음');
    }

    try {
      // 이미지 다운로드 및 메타데이터 확인
      const { buffer, metadata } = await this.downloadAndAnalyzeImage(imageUrl);
      const fileSize = buffer.length;

      // 이미지 크기 및 해상도가 API 제한을 초과하는지 확인
      const needsSplitting = this.needsImageSplitting(fileSize, metadata.width, metadata.height);

      if (needsSplitting) {
        console.log(`대용량 이미지 감지 (${(fileSize / 1024 / 1024).toFixed(2)}MB, ${metadata.width}x${metadata.height}px): 분할 처리`);
        return await this.processLargeImage(buffer, metadata);
      } else {
        // 이미지가 작은 경우 직접 처리
        const tempFilePath = path.join(this.tempDir, `${uuidv4()}.png`);
        fs.writeFileSync(tempFilePath, buffer);
        const result = await this.performOcrOnImage(`file://${tempFilePath}`);
        fs.unlinkSync(tempFilePath);
        return result;
      }
    } catch (error) {
      console.error('이미지 OCR 처리 중 오류:', error);
      throw error;
    }
  }

  /**
   * 이미지 다운로드 및 메타데이터 분석
   */
  private async downloadAndAnalyzeImage(imageUrl: string): Promise<{ buffer: Buffer, metadata: sharp.Metadata }> {
    try {
      // data URL인 경우
      if (imageUrl.startsWith('data:')) {
        const base64Data = imageUrl.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const metadata = await sharp(buffer).metadata();
        return { buffer, metadata };
      }

      // 파일 URL인 경우
      if (imageUrl.startsWith('file://')) {
        const filePath = imageUrl.replace('file://', '');
        const buffer = fs.readFileSync(filePath);
        const metadata = await sharp(buffer).metadata();
        return { buffer, metadata };
      }

      // HTTP URL인 경우
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data, 'binary');
      const metadata = await sharp(buffer).metadata();
      return { buffer, metadata };
    } catch (error) {
      console.error('이미지 다운로드 및 분석 중 오류:', error);
      throw error;
    }
  }

  /**
   * 이미지가 분할 처리가 필요한지 확인
   */
  private needsImageSplitting(fileSize: number, width?: number, height?: number): boolean {
    if (fileSize > this.maxImageSize) {
      return true;
    }
    
    if (width && height && (width > this.maxWidth || height > this.maxHeight)) {
      return true;
    }
    
    return false;
  }

  /**
   * 대용량 이미지 분할 처리
   */
  private async processLargeImage(buffer: Buffer, metadata: sharp.Metadata): Promise<string> {
    const width = metadata.width || 1000;
    const height = metadata.height || 1000;
    
    // 분할 구역 계산
    const segments = this.calculateImageSegments(width, height);
    console.log(`이미지를 ${segments.length}개 세그먼트로 분할 처리`);
    
    // 각 세그먼트 처리 (병렬 처리)
    const ocrPromises = segments.map(async (segment, index) => {
      const { left, top, segmentWidth, segmentHeight } = segment;
      
      // 세그먼트 이미지 생성
      const segmentFilePath = path.join(this.tempDir, `segment_${uuidv4()}.png`);
      await sharp(buffer)
        .extract({ left, top, width: segmentWidth, height: segmentHeight })
        .toFile(segmentFilePath);
      
      console.log(`세그먼트 ${index + 1}/${segments.length} 처리 중 (${segmentWidth}x${segmentHeight}px)`);
      
      // 세그먼트 OCR 처리
      const segmentText = await this.performOcrOnImage(`file://${segmentFilePath}`);
      
      // 임시 파일 삭제
      fs.unlinkSync(segmentFilePath);
      
      return { index, text: segmentText };
    });
    
    // 모든 세그먼트 결과 기다리기
    const results = await Promise.all(ocrPromises);
    
    // 인덱스 순서대로 결과 정렬
    results.sort((a, b) => a.index - b.index);
    
    // 결과 합치기
    return results.map(r => r.text).join('\n\n');
  }

  /**
   * 최적의 이미지 분할 세그먼트 계산 (텍스트 잘림 방지)
   */
  private calculateImageSegments(width: number, height: number): Array<{ left: number, top: number, segmentWidth: number, segmentHeight: number }> {
    const segments = [];
    
    // 가로/세로 분할 수 계산
    const horizontalSplits = Math.ceil(width / this.maxWidth);
    const verticalSplits = Math.ceil(height / this.maxHeight);
    
    // 세그먼트 크기 계산
    const baseSegmentWidth = Math.ceil(width / horizontalSplits);
    const baseSegmentHeight = Math.ceil(height / verticalSplits);
    
    // 세그먼트 생성 (겹침 영역 포함)
    for (let v = 0; v < verticalSplits; v++) {
      for (let h = 0; h < horizontalSplits; h++) {
        // 시작 위치
        const left = h * baseSegmentWidth;
        const top = v * baseSegmentHeight - (v > 0 ? this.overlapHeight : 0);
        
        // 세그먼트 크기 (마지막 조각은 남은 영역)
        const segmentWidth = h === horizontalSplits - 1 
          ? width - left 
          : baseSegmentWidth;
          
        let segmentHeight = v === verticalSplits - 1 
          ? height - (v * baseSegmentHeight - (v > 0 ? this.overlapHeight : 0))
          : baseSegmentHeight + (v > 0 ? this.overlapHeight : 0);
        
        // 세그먼트가 이미지 범위를 벗어나지 않도록 조정
        const adjustedTop = Math.max(0, top);
        segmentHeight = Math.min(height - adjustedTop, segmentHeight);
        
        segments.push({
          left, 
          top: adjustedTop, 
          segmentWidth, 
          segmentHeight
        });
      }
    }
    
    return segments;
  }

  /**
   * 단일 이미지에 OCR 수행
   */
  private async performOcrOnImage(imageUrl: string): Promise<string> {
    if (!this.mistralClient) {
      throw new Error('Mistral API 클라이언트가 초기화되지 않음');
    }

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const ocrResponse = await this.mistralClient.ocr.process({
          model: "mistral-ocr-latest",
          document: {
            type: "image_url",
            imageUrl: imageUrl,
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
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기
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
    try {
      const { buffer: imageBuffer, metadata } = await this.downloadAndAnalyzeImage(imageUrl);
      
      if ((metadata.width && metadata.width > this.maxWidth) || 
          (metadata.height && metadata.height > this.maxHeight)) {
        
        console.log(`이미지 리사이징: ${metadata.width}x${metadata.height}px -> 최대 ${this.maxWidth}x${this.maxHeight}px`);
        
        const tmpResizedPath = path.join(this.tempDir, `${uuidv4()}.png`);
        await sharp(imageBuffer)
          .resize({ 
            width: Math.min(metadata.width!, this.maxWidth), 
            height: Math.min(metadata.height!, this.maxHeight), 
            fit: 'inside',
            withoutEnlargement: true
          })
          .toFile(tmpResizedPath);
        
        return `file://${tmpResizedPath}`;
      }
      
      return imageUrl;
    } catch (error) {
      console.error('이미지 크기 조정 중 오류:', error);
      return imageUrl; // 크기 조정 실패 시 원본 URL 반환
    }
  }

  /**
   * 텍스트 개선 지연 모드 설정
   * @param defer 지연 모드 활성화 여부
   */
  public setDeferTextImprovement(defer: boolean): void {
    this.deferTextImprovement = defer;
  }

  /**
   * Mistral AI를 사용하여 텍스트 개선
   * 속도 제한에 도달하면 재시도하며 대기
   */
  public async improveTextWithMistral(text: string, maxRetries: number = 5): Promise<string> {
    if (!text || text.length < 10) return text;
    if (!this.mistralClient) return text;
    
    // 텍스트 개선 지연 모드에서는 원본 텍스트 반환
    if (this.deferTextImprovement) {
      return text;
    }
    
    let retryCount = 0;
    let retryDelay = 2000; // 초기 대기 시간 (2초)
    
    while (retryCount < maxRetries) {
      try {
        console.log('Mistral AI를 사용하여 텍스트 개선 중...');
        
        const prompt = `
              당신은 채용 공고 텍스트를 깔끔하게 정리하는 전문가입니다. 
              다음 텍스트는 OCR 또는 웹 스크래핑으로 추출된 채용 공고입니다. 
              이 텍스트를 보기 좋고 이해하기 쉬운 형태로 정리해주세요.

              텍스트를 정리할 때 다음 규칙을 따라주세요:
              1. 무의미한 특수 문자, 기호, 랜덤 문자를 제거하세요.
              2. 테이블 형식은 일반 텍스트로 변환하세요.
              3. 문단과 구조를 자연스럽게 유지하세요.
              4. 채용 정보의 핵심 내용(직무 설명, 자격 요건, 우대사항, 복리후생 등)은 반드시 유지하세요.
              5. 이메일, URL, 회사명, 지원 방법 등 중요 정보는 정확히 보존하세요.
              6. 전체 내용을 요약하지 말고, 불필요한 텍스트만 제거하여 가능한 원본의 모든 정보를 유지하세요.
              7. 마크다운 형식으로 반환하지 말고, 문서 서식을 유지하면서 반환하세요.
              8. 채용 공고와는 관련이 없어 보이는 내용은 삭제해도 좋습니다.

              다음은 적절한 변환 예시입니다:

              예시 1:
              {
                "before": "■ 모집부문 ■ \n-백엔드 개발자@@ \n**경력 3~5년차**\n~~~ 자격요건 ~~~\n- JAVA/Spring 프레임워크 경험\n- MySQL 활용 경험\n***우대사항***\nㅁㄴㅇㄹ\n- AWS 클라우드 서비스 경험",
                "after": "모집부문: 백엔드 개발자\n경력: 3~5년차\n\n자격요건:\n- JAVA/Spring 프레임워크 경험\n- MySQL 활용 경험\n\n우대사항:\n- AWS 클라우드 서비스 경험"
              }

              예시 2:
              {
                "before": "|직무|요구사항|우대사항|\n|---|---|---|\n|프론트엔드|React 경험자|TypeScript 능숙자|\n|백엔드|Node.js 경험자|AWS 경험자|\n\n### 지원방법 ###\n이력서 제출 : recruit@company.com\n마감일 : 2023.05.31",
                "after": "직무: 프론트엔드\n요구사항: React 경험자\n우대사항: TypeScript 능숙자\n\n직무: 백엔드\n요구사항: Node.js 경험자\n우대사항: AWS 경험자\n\n지원방법:\n이력서 제출: recruit@company.com\n마감일: 2023.05.31"
              }

              예시 3:
              {
                "before": "☆★☆★ 채용공고 ☆★☆★\n▶▶▶ 주요 업무\n- 데이터 분석\n- 머신러닝 모델 개발\n- 데이터 파이프라인 구축\n\n▶▶▶ 자격 요건\n- 파이썬 고급 사용 가능\n- SQL 능숙\n\n▶▶▶ 근무 조건\n- 연봉: 협의\n- 위치: 서울시 강남구\n- 문의처: 02-123-4567\nhttp://company.com/apply",
                "after": "주요 업무:\n- 데이터 분석\n- 머신러닝 모델 개발\n- 데이터 파이프라인 구축\n\n자격 요건:\n- 파이썬 고급 사용 가능\n- SQL 능숙\n\n근무 조건:\n- 연봉: 협의\n- 위치: 서울시 강남구\n- 문의처: 02-123-4567\n- 지원 링크: http://company.com/apply"
              }

              텍스트:${text}`;

        const response = await this.mistralClient.chat.complete({
          model: "mistral-small-latest",
          messages: [{ role: "user", content: prompt }],
        });

        const content = response?.choices?.[0]?.message?.content || text;
        const improvedText = typeof content === 'string' 
          ? content 
          : Array.isArray(content) 
            ? content
                .map(chunk => {
                  if (typeof chunk === 'string') return chunk;
                  if ('text' in chunk && typeof chunk.text === 'string') return chunk.text;
                  return '';
                })
                .join('') 
          : text;
        return improvedText.trim();
      } catch (error) {
        // 속도 제한 오류 (429) 처리
        if ((error as any).statusCode === 429) {
          retryCount++;
          console.error(`속도 제한 오류, ${retryCount}/${maxRetries} 재시도 (${retryDelay/1000}초 대기)...`);
          
          // 지수 백오프 적용 (점점 더 오래 대기)
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          retryDelay = Math.min(retryDelay * 2, 30000); // 최대 30초까지 증가
        } else {
          console.error('Mistral AI 텍스트 개선 중 오류:', error);
          return text; // 다른 오류는 기존 텍스트 반환
        }
      }
    }
    
    console.warn(`최대 재시도 횟수(${maxRetries})를 초과했습니다. 원본 텍스트를 반환합니다.`);
    return text;
  }

  /**
   * 여러 텍스트를 배치로 개선
   * @param texts 개선할 텍스트 배열
   * @param delayBetweenRequests 요청 사이의 지연 시간 (ms)
   * @returns 개선된 텍스트 배열
   */
  public async batchImproveTexts(texts: string[], delayBetweenRequests: number = 3000): Promise<string[]> {
    const results: string[] = [];
    
    console.log(`총 ${texts.length}개의 텍스트를 일괄 개선 시작...`);
    
    for (let i = 0; i < texts.length; i++) {
      try {
        console.log(`텍스트 ${i+1}/${texts.length} 개선 중...`);
        const improved = await this.improveTextWithMistral(texts[i]);
        results.push(improved);
        
        // 마지막 항목이 아니라면 API 속도 제한을 피하기 위해 대기
        if (i < texts.length - 1) {
          console.log(`다음 요청까지 ${delayBetweenRequests/1000}초 대기...`);
          await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
        }
      } catch (error) {
        console.error(`텍스트 ${i+1} 개선 중 오류:`, error);
        results.push(texts[i]); // 오류 발생 시 원본 반환
      }
    }
    
    return results;
  }
}
