import ScraperControlService from "../services/utils/ScraperControlService";

// 스크래퍼 컨트롤 서비스 인스턴스 생성
const scraperService = new ScraperControlService();

/**
 * 스케줄링된 스크래핑 시작 예제
 */
async function startScheduledScraping() {
  console.log('주중 오후 5시 스크래핑 스케줄링 시작...');
  
  // 스크래핑 설정
  const config = {
    headless: true, // 백그라운드에서 실행
    verbose: true,  // 상세 로깅 활성화
  };
  
  // 스케줄링 시작
  const scheduled = scraperService.scheduleWeekdayScraping(config);
  
  if (scheduled) {
    console.log('✅ 스크래핑이 성공적으로 스케줄링되었습니다.');
    console.log('⏰ 한국 시간 주중 오후 5시(17:00)에 자동으로 실행됩니다.');
    
    // 수동으로 즉시 테스트해보기
    console.log('🧪 지금 즉시 테스트 실행 중...');
    try {
      const jobs = await scraperService.openSaraminWithDuplicateCheck(config);
      console.log(`✅ 테스트 완료: ${jobs.length}개 새 채용공고 수집됨`);
    } catch (error) {
      console.error('❌ 테스트 실패:', error);
    }
  } else {
    console.log('❌ 스크래핑 스케줄링에 실패했습니다.');
  }

  console.log('\n프로그램이 백그라운드에서 실행 중입니다. Ctrl+C로 종료할 수 있습니다.');
}

// 스케줄링 시작
startScheduledScraping().catch(console.error);

// 프로세스 종료 처리
process.on('SIGINT', () => {
  console.log('스크래핑 스케줄러를 종료합니다...');
  scraperService.stopScheduledScraping();
  process.exit(0);
});
