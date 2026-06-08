import personnelData from '../data/personnel.json';

class PersonnelService {
  private personnel: string[] = personnelData;

  getPersonnelList(): string[] {
    return this.personnel;
  }

  searchPersonnel(query: string): string[] {
    if (!query) return this.personnel;
    const lowerQuery = query.toLocaleLowerCase('tr-TR');
    return this.personnel.filter(p => p.toLocaleLowerCase('tr-TR').includes(lowerQuery));
  }
}

export const personnelService = new PersonnelService();
