import jobCodes from '../data/job_codes.json';

export interface JobCode {
  code: string;
  name: string;
  category: 'WORK' | 'TRAVEL' | 'WAITING' | 'BREAK' | 'OFFICE' | 'OTHER';
}

class JobCodeService {
  private codes: JobCode[] = jobCodes as JobCode[];

  getJobCodes(): JobCode[] {
    return this.codes;
  }

  getJobCodeByCode(code: string): JobCode | undefined {
    return this.codes.find(c => c.code === code);
  }

  searchJobCodes(query: string): JobCode[] {
    const q = query.toLowerCase();
    return this.codes.filter(c => 
      c.code.includes(q) || 
      c.name.toLowerCase().includes(q)
    );
  }
}

export const jobCodeService = new JobCodeService();
