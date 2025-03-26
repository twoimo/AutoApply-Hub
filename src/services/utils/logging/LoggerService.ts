import colors from 'ansi-colors';

/**
 * 로깅 레벨 타입
 */
export type LogLevel = 'info' | 'success' | 'warning' | 'error';

/**
 * 로깅 유틸리티 서비스
 */
export class LoggerService {
  private verboseLogging: boolean;

  constructor(verbose: boolean = false) {
    this.verboseLogging = verbose;
  }

  /**
   * 로그 레벨 설정
   */
  public setVerbose(verbose: boolean): void {
    this.verboseLogging = verbose;
  }

  /**
   * 일반 로그 출력
   */
  public log(message: string, level: LogLevel = 'info'): void {
    let formattedMessage = '';
    
    switch(level) {
      case 'success':
        formattedMessage = colors.green('✅ ' + message);
        break;
      case 'warning':
        formattedMessage = colors.yellow('⚠️  ' + message);
        break;
      case 'error':
        formattedMessage = colors.red('❌ ' + message);
        break;
      default:
        formattedMessage = colors.blue('ℹ️  ' + message);
    }
    
    console.log(formattedMessage);
  }

  /**
   * 상세 로그 출력 (verbose 모드일 때만)
   */
  public logVerbose(message: string): void {
    if (this.verboseLogging) {
      console.log(colors.gray('   ' + message));
    }
  }

  /**
   * 구분선 출력
   */
  public logSeparator(): void {
    console.log(colors.yellow.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  }
}
