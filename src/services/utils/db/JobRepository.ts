import sequelize from "sequelize";
import { LoggerService } from "../logging/LoggerService";
import { JobInfo } from "../types/JobTypes";
import CompanyRecruitmentTable from "../../../models/main/CompanyRecruitmentTable";

/**
 * 채용 정보 저장소 - 데이터베이스 작업 처리
 */
export class JobRepository {
  private logger: LoggerService;
  
  constructor(logger: LoggerService) {
    this.logger = logger;
  }

  /**
   * 채용 정보를 데이터베이스에 저장
   */
  public async saveJob(job: JobInfo, url: string): Promise<void> {
    try {
      await CompanyRecruitmentTable.create({
        company_name: job.companyName,
        job_title: job.jobTitle,
        job_location: job.jobLocation,
        job_type: job.jobType,
        job_salary: job.jobSalary,
        deadline: job.deadline,
        employment_type: job.employmentType || "",
        job_url: url,
        company_type: job.companyType || "",
        job_description: job.jobDescription || "",
        description_type: job.descriptionType || "text",
        scraped_at: new Date(),
        is_applied: false
      });

      this.logger.logVerbose(`채용 정보 저장: ${job.companyName} - ${job.jobTitle}`);
    } catch (error) {
      this.logger.log(`채용 정보 저장 실패: ${error}`, 'error');
      throw error;
    }
  }

  /**
   * 이미 존재하는 URL 목록 확인
   */
  public async checkExistingUrls(urls: string[]): Promise<string[]> {
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
      this.logger.log(`기존 URL 확인 중 오류: ${error}`, 'error');
      return [];
    }
  }

  /**
   * 채용 데이터 통계 생성
   */
  public createJobStatistics(jobs: JobInfo[]): {
    companyCounts: Record<string, number>,
    jobTypeCounts: Record<string, number>,
    employmentTypeCounts: Record<string, number>,
    topCompanies: [string, number][]
  } {
    const companyCounts: Record<string, number> = {};
    const jobTypeCounts: Record<string, number> = {};
    const employmentTypeCounts: Record<string, number> = {};
    
    jobs.forEach(job => {
      // 회사 카운트
      const company = job.companyName;
      companyCounts[company] = (companyCounts[company] || 0) + 1;
      
      // 직무 유형 카운트
      const jobType = job.jobType || '명시되지 않음';
      jobTypeCounts[jobType] = (jobTypeCounts[jobType] || 0) + 1;
      
      // 고용 형태 카운트
      const empType = job.employmentType || '명시되지 않음';
      employmentTypeCounts[empType] = (employmentTypeCounts[empType] || 0) + 1;
    });
    
    // 상위 회사 목록
    const topCompanies = Object.entries(companyCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    return {
      companyCounts,
      jobTypeCounts,
      employmentTypeCounts,
      topCompanies
    };
  }
}
