import colors from 'ansi-colors';
import { ConfigService } from '../config/ConfigService';
import { LoggingConstants } from '../constants/AppConstants';

/**
 * 로그 레벨 타입
 */
type LogLevel = 'debug' | 'info' | 'success' | 'warning' | 'error';

/**
 * 로깅 서비스
 */
export class LoggerService {
  private configService: ConfigService;
  private logLevel: LogLevel;
  private verboseLogging: boolean;

  constructor(private consoleOutput: boolean = true, verbose: boolean = false) {
    this.configService = new ConfigService();
    this.logLevel = this.getLogLevelFromConfig();
    this.verboseLogging = verbose;
  }

  /**
   * 설정에서 로그 레벨 가져오기
   */
  private getLogLevelFromConfig(): LogLevel {
    const configLevel = this.configService.getLogLevel().toLowerCase();
    if (configLevel in LoggingConstants.PRIORITY) {
      return configLevel as LogLevel;
    }
    return LoggingConstants.DEFAULT_LEVEL as LogLevel;
  }

  /**
   * 로그 메시지 기록
   */
  public log(message: string, level: LogLevel = LoggingConstants.DEFAULT_LEVEL as LogLevel): void {
    // 현재 설정된 레벨보다 우선순위가 낮으면 로깅하지 않음
    if (LoggingConstants.PRIORITY[level] < LoggingConstants.PRIORITY[this.logLevel]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    // 콘솔 출력이 활성화된 경우 콘솔에 로그 출력
    if (this.consoleOutput) {
      this.printColoredLog(formattedMessage, level);
    }

    // 로그 파일에 저장 로직 (필요시 구현)
    // TODO: 로그 파일 저장 기능 구현
  }

  /**
   * 색상이 적용된 로그 출력
   */
  private printColoredLog(message: string, level: LogLevel): void {
    switch (level) {
      case LoggingConstants.LEVELS.DEBUG:
        console.debug(message);
        break;
      case LoggingConstants.LEVELS.INFO:
        console.info(message);
        break;
      case LoggingConstants.LEVELS.SUCCESS:
        console.log(colors.green(message));
        break;
      case LoggingConstants.LEVELS.WARNING:
        console.warn(colors.yellow(message));
        break;
      case LoggingConstants.LEVELS.ERROR:
        console.error(colors.red(message));
        break;
      default:
        console.log(message);
    }
  }

  /**
   * 로그 레벨 설정
   */
  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * 상세 로그 출력 모드 설정
   */
  public setVerbose(verbose: boolean): void {
    this.verboseLogging = verbose;
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
