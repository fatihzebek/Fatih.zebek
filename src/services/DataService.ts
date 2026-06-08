import type { Site, Turbine } from '../types';

export interface Warehouse {
  id: string;
  name: string;
  location?: string;
}

export class DataService {
  private warehouses: Warehouse[] = [
    { id: 'W01', name: 'Anemon İntepe Depo' },
    { id: 'W02', name: 'Alize Sarıkaya Depo' },
    { id: 'W03', name: 'Alize Çamseki Depo' },
    { id: 'W04', name: 'Mare Manastır Depo' },
    { id: 'W05', name: 'Alize Germiyan Depo' },
    { id: 'W06', name: 'Doğal Sayalar Depo' },
    { id: 'W07', name: 'Dares Datça Depo' },
    { id: 'W08', name: 'Alize Keltepe Depo' },
    { id: 'W09', name: 'Alize Kuyucak Depo' },
    { id: 'W10', name: 'Alize Çataltape Depo' }
  ];
  private sites: Site[] = [
    { id: '0752', name: 'Alize Germiyan', turbineCount: 7 },
    { id: '2678', name: 'Mare Manastır', turbineCount: 55 }, 
    { id: '2688', name: 'Anemon İntepe', turbineCount: 49 }, 
    { id: '2990', name: 'Doğal Sayalar', turbineCount: 48 },
    { id: '3213', name: 'Dares Datça', turbineCount: 36 },
    { id: '3243', name: 'Alize Çamseki', turbineCount: 11 },
    { id: '3245', name: 'Alize Keltepe', turbineCount: 27 },
    { id: '3439', name: 'Alize Sarıkaya', turbineCount: 15 },
    { id: '3793', name: 'Alize Kuyucak', turbineCount: 23 },
    { id: '3892', name: 'Alize Çataltape', turbineCount: 13 }
  ];

  public static readonly customOrder = [
    'Alize Germiyan',
    'Mare Manastır',
    'Anemon İntepe',
    'Doğal Sayalar',
    'Dares Datça',
    'Alize Çamseki',
    'Alize Keltepe',
    'Alize Sarıkaya',
    'Alize Kuyucak',
    'Alize Çataltape'
  ];

  public getSortedSites(): Site[] {
    return this.getSites().sort((a, b) => {
      const indexA = DataService.customOrder.findIndex(o => o.toLowerCase() === a.name.toLowerCase());
      const indexB = DataService.customOrder.findIndex(o => o.toLowerCase() === b.name.toLowerCase());
      if (indexA === -1 && indexB === -1) return a.name.localeCompare(b.name);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }


  private siteToWarehouseMap: Record<string, string> = {
    '2688': 'W01', // Anemon İntepe
    '3439': 'W02', // Alize Sarıkaya
    '3243': 'W03', // Alize Çamseki
    '2678': 'W04', // Mare Manastır
    '0752': 'W05', // Alize Germiyan
    '2990': 'W06', // Doğal Sayalar
    '3213': 'W07', // Dares Datça
    '3245': 'W08', // Alize Keltepe
    '3793': 'W09', // Alize Kuyucak
    '3892': 'W10'  // Alize Çataltape
  };

  private turbineData: Record<string, { no: number, serial: string, label?: string, latitude?: number, longitude?: number, controlType?: string, commissioningDate?: string, type?: string }[]> = {
    '0752': [
      { no: 1, serial: "41193", controlType: "CS40", type: "E40", commissioningDate: "2/19/1998", latitude: 38.304875, longitude: 26.464136 },
      { no: 2, serial: "41194", controlType: "CS40", type: "E40", commissioningDate: "2/19/1998", latitude: 38.305041, longitude: 26.463031 },
      { no: 3, serial: "41195", controlType: "CS40", type: "E40", commissioningDate: "2/20/1998", latitude: 38.305283, longitude: 26.461625 },
      { no: 4, serial: "826423", controlType: "CS82", type: "E-82", commissioningDate: "2/9/2017", latitude: 38.306622, longitude: 26.458449 },
      { no: 5, serial: "826424", controlType: "CS82", type: "E-82", commissioningDate: "1/31/2017", latitude: 38.308062, longitude: 26.455755 },
      { no: 6, serial: "826425", controlType: "CS82", type: "E-82", commissioningDate: "1/13/2017", latitude: 38.303874, longitude: 26.466845 },
      { no: 7, serial: "826426", controlType: "CS82", type: "E-82", commissioningDate: "1/24/2017", latitude: 38.303189, longitude: 26.469527 }
    ],
    '2678': [
      { no: 1, serial: "48860", controlType: "CS48", type: "E-48", commissioningDate: "12/1/2006", latitude: 38.28637, longitude: 26.48935 },
      { no: 2, serial: "48861", controlType: "CS48", type: "E-48", commissioningDate: "12/1/2006", latitude: 38.28613, longitude: 26.49017 },
      { no: 3, serial: "48862", controlType: "CS48", type: "E-48", commissioningDate: "12/2/2006", latitude: 38.2859, longitude: 26.49095 },
      { no: 4, serial: "48863", controlType: "CS48", type: "E-48", commissioningDate: "12/2/2006", latitude: 38.28768, longitude: 26.4921 },
      { no: 5, serial: "48864", controlType: "CS48", type: "E-48", commissioningDate: "12/3/2006", latitude: 38.2875, longitude: 26.4929 },
      { no: 6, serial: "48866", controlType: "CS48", type: "E-48", commissioningDate: "12/4/2006", latitude: 38.28909, longitude: 26.4951 },
      { no: 7, serial: "48867", controlType: "CS48", type: "E-48", commissioningDate: "12/2/2006", latitude: 38.28901, longitude: 26.49595 },
      { no: 8, serial: "48868", controlType: "CS48", type: "E-48", commissioningDate: "12/2/2006", latitude: 38.28898, longitude: 26.49676 },
      { no: 9, serial: "48869", controlType: "CS48", type: "E-48", commissioningDate: "12/2/2006", latitude: 38.28898, longitude: 26.49762 },
      { no: 10, serial: "48870", controlType: "CS48", type: "E-48", commissioningDate: "12/7/2006", latitude: 38.28895, longitude: 26.49848 },
      { no: 11, serial: "450011", controlType: "CS48", type: "E-44", commissioningDate: "12/16/2006", latitude: 38.27894, longitude: 26.47548 },
      { no: 12, serial: "450012", controlType: "CS48", type: "E-44", commissioningDate: "12/18/2006", latitude: 38.27873, longitude: 26.4764 },
      { no: 13, serial: "48871", controlType: "CS48", type: "E-48", commissioningDate: "12/14/2006", latitude: 38.28881, longitude: 26.49933 },
      { no: 14, serial: "450014", controlType: "CS48", type: "E-44", commissioningDate: "1/16/2007", latitude: 38.27957, longitude: 26.47873 },
      { no: 15, serial: "450015", controlType: "CS48", type: "E-44", commissioningDate: "12/19/2006", latitude: 38.27935, longitude: 26.47967 },
      { no: 16, serial: "48872", controlType: "CS48", type: "E-48", commissioningDate: "12/17/2006", latitude: 38.28856, longitude: 26.50013 },
      { no: 17, serial: "48873", controlType: "CS48", type: "E-48", commissioningDate: "12/17/2006", latitude: 38.28472, longitude: 26.50372 },
      { no: 18, serial: "48874", controlType: "CS48", type: "E-48", commissioningDate: "12/14/2006", latitude: 38.28637, longitude: 26.50396 },
      { no: 19, serial: "48875", controlType: "CS48", type: "E-48", commissioningDate: "12/14/2006", latitude: 38.2862, longitude: 26.50491 },
      { no: 20, serial: "450020", controlType: "CS48", type: "E-44", commissioningDate: "1/18/2007", latitude: 38.28113, longitude: 26.48447 },
      { no: 21, serial: "48876", controlType: "CS48", type: "E-48", commissioningDate: "12/17/2006", latitude: 38.2861, longitude: 26.50576 },
      { no: 22, serial: "450022", controlType: "CS48", type: "E-44", commissioningDate: "1/16/2007", latitude: 38.28257, longitude: 26.48677 },
      { no: 23, serial: "450023", controlType: "CS48", type: "E-44", commissioningDate: "1/17/2007", latitude: 38.28238, longitude: 26.48771 },
      { no: 24, serial: "450024", controlType: "CS48", type: "E-44", commissioningDate: "1/16/2007", latitude: 38.28231, longitude: 26.48863 },
      { no: 25, serial: "450025", controlType: "CS48", type: "E-44", commissioningDate: "2/26/2007", latitude: 38.28829, longitude: 26.48312 },
      { no: 26, serial: "450026", controlType: "CS48", type: "E-44", commissioningDate: "2/25/2007", latitude: 38.28811, longitude: 26.48393 },
      { no: 27, serial: "450027", controlType: "CS48", type: "E-44", commissioningDate: "2/27/2007", latitude: 38.28787, longitude: 26.4847 },
      { no: 28, serial: "450028", controlType: "CS48", type: "E-44", commissioningDate: "2/26/2007", latitude: 38.28761, longitude: 26.4855 },
      { no: 29, serial: "450029", controlType: "CS48", type: "E-44", commissioningDate: "2/26/2017", latitude: 38.28734, longitude: 26.48627 },
      { no: 30, serial: "450030", controlType: "CS48", type: "E-44", commissioningDate: "2/22/2007", latitude: 38.28706, longitude: 26.48707 },
      { no: 31, serial: "450031", controlType: "CS48", type: "E-44", commissioningDate: "2/9/2007", latitude: 38.2868, longitude: 26.48781 },
      { no: 32, serial: "450032", controlType: "CS48", type: "E-44", commissioningDate: "1/31/2007", latitude: 38.28657, longitude: 26.48858 },
      { no: 33, serial: "450001", controlType: "CS48", type: "E-44", commissioningDate: "1/30/2007", latitude: 38.28722, longitude: 26.49 },
      { no: 34, serial: "450002", controlType: "CS48", type: "E-44", commissioningDate: "1/30/2007", latitude: 38.28667, longitude: 26.49028 },
      { no: 35, serial: "450003", controlType: "CS48", type: "E-44", commissioningDate: "2/28/2007", latitude: 38.28694, longitude: 26.49167 },
      { no: 36, serial: "450004", controlType: "CS48", type: "E-44", commissioningDate: "3/2/2007", latitude: 38.28861, longitude: 26.49278 },
      { no: 37, serial: "450005", controlType: "CS48", type: "E-44", commissioningDate: "3/1/2007", latitude: 38.28833, longitude: 26.49361 },
      { no: 38, serial: "48865", controlType: "CS48", type: "E-48", commissioningDate: "2/16/2007", latitude: 38.28922, longitude: 26.49429 },
      { no: 39, serial: "450006", controlType: "CS48", type: "E-44", commissioningDate: "3/20/2007", latitude: 38.29028, longitude: 26.49583 },
      { no: 40, serial: "450007", controlType: "CS48", type: "E-44", commissioningDate: "3/8/2007", latitude: 38.29, longitude: 26.49667 },
      { no: 41, serial: "450008", controlType: "CS48", type: "E-44", commissioningDate: "3/7/2007", latitude: 38.29, longitude: 26.4975 },
      { no: 42, serial: "450009", controlType: "CS48", type: "E-44", commissioningDate: "3/11/2007", latitude: 38.29, longitude: 26.49833 },
      { no: 43, serial: "450010", controlType: "CS48", type: "E-44", commissioningDate: "3/19/2007", latitude: 38.29, longitude: 26.49912 },
      { no: 44, serial: "450013", controlType: "CS48", type: "E-44", commissioningDate: "3/12/2007", latitude: 38.27947, longitude: 26.47765 },
      { no: 45, serial: "450016", controlType: "CS48", type: "E-44", commissioningDate: "3/11/2007", latitude: 38.28041, longitude: 26.48061 },
      { no: 46, serial: "450017", controlType: "CS48", type: "E-44", commissioningDate: "3/19/2007", latitude: 38.28022, longitude: 26.48165 },
      { no: 47, serial: "450018", controlType: "CS48", type: "E-44", commissioningDate: "3/8/2007", latitude: 38.28007, longitude: 26.48243 },
      { no: 48, serial: "450019", controlType: "CS48", type: "E-44", commissioningDate: "3/7/2007", latitude: 38.28135, longitude: 26.48354 },
      { no: 49, serial: "450021", controlType: "CS48", type: "E-44", commissioningDate: "3/10/2007", latitude: 38.28091, longitude: 26.48545 },
      { no: 50, serial: "826427", controlType: "CS82", type: "E-82", commissioningDate: "11/19/2016", latitude: 38.28645, longitude: 26.49482 },
      { no: 51, serial: "826428", controlType: "CS82", type: "E-82", commissioningDate: "11/21/2016", latitude: 38.28681, longitude: 26.49732 },
      { no: 52, serial: "826429", controlType: "CS82", type: "E-82", commissioningDate: "11/12/2016", latitude: 38.28653, longitude: 26.49974 },
      { no: 53, serial: "826430", controlType: "CS82", type: "E-82", commissioningDate: "11/12/2016", latitude: 38.28567, longitude: 26.50198 },
      { no: 54, serial: "826431", controlType: "CS82", type: "E-82", commissioningDate: "11/25/2016", latitude: 38.28569, longitude: 26.50846 },
      { no: 55, serial: "826432", controlType: "CS82", type: "E-82", commissioningDate: "12/2/2016", latitude: 38.28596, longitude: 26.51119 }
    ],
    '2688': [
      { no: 1, serial: "48886", controlType: "CS48", type: "E-48", commissioningDate: "6/7/2007", latitude: 40.040866, longitude: 26.387541 },
      { no: 2, serial: "48895", controlType: "CS48", type: "E-48", commissioningDate: "3/27/2007", latitude: 40.040249, longitude: 26.388354 },
      { no: 3, serial: "48896", controlType: "CS48", type: "E-48", commissioningDate: "3/19/2007", latitude: 40.039706, longitude: 26.389161 },
      { no: 4, serial: "48897", controlType: "CS48", type: "E-48", commissioningDate: "3/26/2007", latitude: 40.03916, longitude: 26.390058 },
      { no: 5, serial: "48898", controlType: "CS48", type: "E-48", commissioningDate: "3/30/2007", latitude: 40.038744, longitude: 26.391036 },
      { no: 6, serial: "48899", controlType: "CS48", type: "E-48", commissioningDate: "3/29/2007", latitude: 40.038344, longitude: 26.392044 },
      { no: 7, serial: "48900", controlType: "CS48", type: "E-48", commissioningDate: "4/2/2007", latitude: 40.037809, longitude: 26.392918 },
      { no: 8, serial: "48901", controlType: "CS48", type: "E-48", commissioningDate: "4/7/2007", latitude: 40.037334, longitude: 26.393884 },
      { no: 9, serial: "48902", controlType: "CS48", type: "E-48", commissioningDate: "4/7/2007", latitude: 40.036873, longitude: 26.394821 },
      { no: 10, serial: "48903", controlType: "CS48", type: "E-48", commissioningDate: "4/12/2007", latitude: 40.036526, longitude: 26.39587 },
      { no: 11, serial: "48904", controlType: "CS48", type: "E-48", commissioningDate: "4/15/2007", latitude: 40.036125, longitude: 26.396838 },
      { no: 12, serial: "48905", controlType: "CS48", type: "E-48", commissioningDate: "4/19/2007", latitude: 40.035217, longitude: 26.398316 },
      { no: 13, serial: "48906", controlType: "CS48", type: "E-48", commissioningDate: "4/23/2007", latitude: 40.034805, longitude: 26.399317 },
      { no: 14, serial: "48907", controlType: "CS48", type: "E-48", commissioningDate: "4/30/2007", latitude: 40.034126, longitude: 26.400047 },
      { no: 15, serial: "48908", controlType: "CS48", type: "E-48", commissioningDate: "5/7/2007", latitude: 40.033331, longitude: 26.400551 },
      { no: 16, serial: "48909", controlType: "CS48", type: "E-48", commissioningDate: "2/14/2007", latitude: 40.033667, longitude: 26.406858 },
      { no: 17, serial: "48910", controlType: "CS48", type: "E-48", commissioningDate: "2/12/2007", latitude: 40.033348, longitude: 26.407874 },
      { no: 18, serial: "48911", controlType: "CS48", type: "E-48", commissioningDate: "2/8/2007", latitude: 40.032945, longitude: 26.408847 },
      { no: 19, serial: "48912", controlType: "CS48", type: "E-48", commissioningDate: "2/8/2007", latitude: 40.032677, longitude: 26.409917 },
      { no: 20, serial: "48913", controlType: "CS48", type: "E-48", commissioningDate: "2/7/2007", latitude: 40.032325, longitude: 26.41096 },
      { no: 21, serial: "48914", controlType: "CS48", type: "E-48", commissioningDate: "2/9/2007", latitude: 40.032061, longitude: 26.412513 },
      { no: 22, serial: "48915", controlType: "CS48", type: "E-48", commissioningDate: "2/6/2007", latitude: 40.031787, longitude: 26.41425 },
      { no: 23, serial: "48916", controlType: "CS48", type: "E-48", commissioningDate: "2/6/2007", latitude: 40.031594, longitude: 26.415368 },
      { no: 24, serial: "48917", controlType: "CS48", type: "E-48", commissioningDate: "2/1/2007", latitude: 40.031211, longitude: 26.416366 },
      { no: 25, serial: "48887", controlType: "CS48", type: "E-48", commissioningDate: "6/8/2007", latitude: 40.030782, longitude: 26.417331 },
      { no: 26, serial: "48888", controlType: "CS48", type: "E-48", commissioningDate: "6/12/2007", latitude: 40.030249, longitude: 26.418231 },
      { no: 27, serial: "48889", controlType: "CS48", type: "E-48", commissioningDate: "6/8/2007", latitude: 40.02963, longitude: 26.418999 },
      { no: 28, serial: "48890", controlType: "CS48", type: "E-48", commissioningDate: "6/25/2007", latitude: 40.028878, longitude: 26.419551 },
      { no: 29, serial: "48918", controlType: "CS48", type: "E-48", commissioningDate: "2/14/2007", latitude: 40.027913, longitude: 26.419852 },
      { no: 30, serial: "48919", controlType: "CS48", type: "E-48", commissioningDate: "6/5/2007", latitude: 40.026322, longitude: 26.425714 },
      { no: 31, serial: "48920", controlType: "CS48", type: "E-48", commissioningDate: "5/30/2007", latitude: 40.026131, longitude: 26.426735 },
      { no: 32, serial: "48891", controlType: "CS48", type: "E-48", commissioningDate: "6/5/2007", latitude: 40.02595, longitude: 26.428127 },
      { no: 33, serial: "48892", controlType: "CS48", type: "E-48", commissioningDate: "5/24/2007", latitude: 40.025955, longitude: 26.429245 },
      { no: 34, serial: "48893", controlType: "CS48", type: "E-48", commissioningDate: "6/5/2007", latitude: 40.025856, longitude: 26.430348 },
      { no: 35, serial: "48884", controlType: "CS48", type: "E-48", commissioningDate: "5/11/2007", latitude: 40.025394, longitude: 26.431892 },
      { no: 36, serial: "48885", controlType: "CS48", type: "E-48", commissioningDate: "5/21/2007", latitude: 40.024974, longitude: 26.433268 },
      { no: 37, serial: "48894", controlType: "CS48", type: "E-48", commissioningDate: "5/30/2007", latitude: 40.025121, longitude: 26.434409 },
      { no: 38, serial: "48921", controlType: "CS48", type: "E-48", commissioningDate: "5/4/2007", latitude: 40.024997, longitude: 26.435832 },
      { no: 39, serial: "825762", controlType: "CS82", type: "E-82", commissioningDate: "1/22/2014", latitude: 40.0350924815518, longitude: 26.3861650771718 },
      { no: 40, serial: "825763", controlType: "CS82", type: "E-82", commissioningDate: "1/17/2014", latitude: 40.0384481100246, longitude: 26.3818449052751 },
      { no: 41, serial: "826414", controlType: "CS82", type: "E-82", commissioningDate: "5/4/2016", latitude: 40.0252604508035, longitude: 26.4135005284978 },
      { no: 42, serial: "826415", controlType: "CS82", type: "E-82", commissioningDate: "5/19/2016", latitude: 40.0306120062927, longitude: 26.394210136848 },
      { no: 43, serial: "826416", controlType: "CS82", type: "E-82", commissioningDate: "7/20/2016", latitude: 40.03255, longitude: 26.402855 },
      { no: 44, serial: "826417", controlType: "CS82", type: "E-82", commissioningDate: "5/19/2016", latitude: 40.0315172481149, longitude: 26.3915884909899 },
      { no: 45, serial: "826418", controlType: "CS82", type: "E-82", commissioningDate: "5/19/2016", latitude: 40.0296795548501, longitude: 26.3968085131298 },
      { no: 46, serial: "826419", controlType: "CS82", type: "E-82", commissioningDate: "5/19/2016", latitude: 40.0285853529655, longitude: 26.401240399984 },
      { no: 47, serial: "826420", controlType: "CS82", type: "E-82", commissioningDate: "5/1/2016", latitude: 40.0279992912984, longitude: 26.4046521019477 },
      { no: 48, serial: "826421", controlType: "CS82", type: "E-82", commissioningDate: "5/3/2016", latitude: 40.0270148330103, longitude: 26.4076974376482 },
      { no: 49, serial: "826422", controlType: "CS82", type: "E-82", commissioningDate: "5/3/2016", latitude: 40.026278865459, longitude: 26.4106209790451 }
    ],
    '2990': [
      { no: 1, serial: "450052", controlType: "CS48", type: "E-44", commissioningDate: "5/24/2008", latitude: 39.1745813999417, longitude: 27.8952378854168 },
      { no: 2, serial: "450053", controlType: "CS48", type: "E-44", commissioningDate: "5/24/2008", latitude: 39.1738564364091, longitude: 27.8969420197641 },
      { no: 3, serial: "450054", controlType: "CS48", type: "E-44", commissioningDate: "5/24/2008", latitude: 39.1729931780104, longitude: 27.8978803165873 },
      { no: 4, serial: "450055", controlType: "CS48", type: "E-44", commissioningDate: "5/24/2008", latitude: 39.1719955660403, longitude: 27.8987126940666 },
      { no: 5, serial: "450056", controlType: "CS48", type: "E-44", commissioningDate: "5/24/2008", latitude: 39.171774127197, longitude: 27.9005504903125 },
      { no: 6, serial: "450057", controlType: "CS48", type: "E-44", commissioningDate: "5/24/2008", latitude: 39.1709093177622, longitude: 27.901685488711 },
      { no: 7, serial: "450058", controlType: "CS48", type: "E-44", commissioningDate: "5/20/2008", latitude: 39.1703823011615, longitude: 27.9034151529619 },
      { no: 8, serial: "450059", controlType: "CS48", type: "E-44", commissioningDate: "5/19/2008", latitude: 39.1692992480477, longitude: 27.9048019654089 },
      { no: 9, serial: "450060", controlType: "CS48", type: "E-44", commissioningDate: "5/19/2008", latitude: 39.1683541180419, longitude: 27.9058316610498 },
      { no: 10, serial: "450061", controlType: "CS48", type: "E-44", commissioningDate: "5/19/2008", latitude: 39.167706367758, longitude: 27.9078614698418 },
      { no: 11, serial: "450062", controlType: "CS48", type: "E-44", commissioningDate: "5/17/2008", latitude: 39.1672155058936, longitude: 27.9097179786404 },
      { no: 12, serial: "450063", controlType: "CS48", type: "E-44", commissioningDate: "5/17/2008", latitude: 39.166279267087, longitude: 27.9111110255022 },
      { no: 13, serial: "450064", controlType: "CS48", type: "E-44", commissioningDate: "5/17/2008", latitude: 39.1688538260604, longitude: 27.9133854345203 },
      { no: 14, serial: "450065", controlType: "CS48", type: "E-44", commissioningDate: "5/17/2008", latitude: 39.1691871606518, longitude: 27.9122437460724 },
      { no: 15, serial: "450066", controlType: "CS48", type: "E-44", commissioningDate: "5/20/2008", latitude: 39.1692381362377, longitude: 27.9103344023389 },
      { no: 16, serial: "450067", controlType: "CS48", type: "E-44", commissioningDate: "5/12/2008", latitude: 39.1967156214265, longitude: 27.91679171638 },
      { no: 17, serial: "450068", controlType: "CS48", type: "E-44", commissioningDate: "5/12/2008", latitude: 39.1954690658933, longitude: 27.9171808177904 },
      { no: 18, serial: "450069", controlType: "CS48", type: "E-44", commissioningDate: "5/12/2008", latitude: 39.1937970372683, longitude: 27.917819127348 },
      { no: 19, serial: "450070", controlType: "CS48", type: "E-44", commissioningDate: "5/12/2008", latitude: 39.1920516142002, longitude: 27.9197649365087 },
      { no: 20, serial: "450071", controlType: "CS48", type: "E-44", commissioningDate: "5/11/2008", latitude: 39.1900512254968, longitude: 27.9220431154012 },
      { no: 21, serial: "450072", controlType: "CS48", type: "E-44", commissioningDate: "5/11/2008", latitude: 39.1879648263221, longitude: 27.9237989915971 },
      { no: 22, serial: "450073", controlType: "CS48", type: "E-44", commissioningDate: "5/11/2008", latitude: 39.1856523246759, longitude: 27.9245213168509 },
      { no: 23, serial: "450074", controlType: "CS48", type: "E-44", commissioningDate: "5/9/2008", latitude: 39.1836873407546, longitude: 27.9245997770219 },
      { no: 24, serial: "450075", controlType: "CS48", type: "E-44", commissioningDate: "5/8/2008", latitude: 39.1808053707494, longitude: 27.9255461220757 },
      { no: 25, serial: "450076", controlType: "CS48", type: "E-44", commissioningDate: "6/21/2008", latitude: 39.1529369245301, longitude: 27.9365572597109 },
      { no: 26, serial: "450077", controlType: "CS48", type: "E-44", commissioningDate: "6/21/2008", latitude: 39.1524417091568, longitude: 27.9387495650992 },
      { no: 27, serial: "450078", controlType: "CS48", type: "E-44", commissioningDate: "6/21/2008", latitude: 39.1516078127884, longitude: 27.9404744144601 },
      { no: 28, serial: "450079", controlType: "CS48", type: "E-44", commissioningDate: "6/21/2008", latitude: 39.1501285730381, longitude: 27.942884974436 },
      { no: 29, serial: "450080", controlType: "CS48", type: "E-44", commissioningDate: "6/22/2008", latitude: 39.1487125412836, longitude: 27.9452731345885 },
      { no: 30, serial: "450081", controlType: "CS48", type: "E-44", commissioningDate: "6/21/2008", latitude: 39.1475212562347, longitude: 27.9466111442177 },
      { no: 31, serial: "450082", controlType: "CS48", type: "E-44", commissioningDate: "6/22/2008", latitude: 39.1454361882037, longitude: 27.9481569845323 },
      { no: 32, serial: "450083", controlType: "CS48", type: "E-44", commissioningDate: "6/22/2008", latitude: 39.1451609438639, longitude: 27.95207613165 },
      { no: 33, serial: "450084", controlType: "CS48", type: "E-44", commissioningDate: "6/22/2008", latitude: 39.144183083428, longitude: 27.9548517222679 },
      { no: 34, serial: "450085", controlType: "CS48", type: "E-44", commissioningDate: "6/22/2008", latitude: 39.143790215833, longitude: 27.9573567515576 },
      { no: 35, serial: "450086", controlType: "CS48", type: "E-44", commissioningDate: "8/12/2008", latitude: 39.1432981455042, longitude: 27.9594683617166 },
      { no: 36, serial: "450087", controlType: "CS48", type: "E-44", commissioningDate: "8/12/2008", latitude: 39.142696934757, longitude: 27.9618545619945 },
      { no: 37, serial: "450088", controlType: "CS48", type: "E-44", commissioningDate: "8/12/2008", latitude: 39.1410417878143, longitude: 27.9631867725237 },
      { no: 38, serial: "450089", controlType: "CS48", type: "E-44", commissioningDate: "8/13/2008", latitude: 39.138823776228, longitude: 27.9655863986829 },
      { no: 39, serial: "783606", controlType: "CS82", type: "E-70", commissioningDate: "8/16/2013", latitude: 39.2153594495384, longitude: 27.9559657063587 },
      { no: 40, serial: "783607", controlType: "CS82", type: "E-70", commissioningDate: "8/16/2013", latitude: 39.2159508882889, longitude: 27.9585568277556 },
      { no: 41, serial: "783608", controlType: "CS82", type: "E-70", commissioningDate: "9/11/2013", latitude: 39.2166952434176, longitude: 27.9611732445413 },
      { no: 42, serial: "824185", controlType: "CS82", type: "E-82", commissioningDate: "10/22/2013", latitude: 39.2167190470491, longitude: 27.9637451133782 },
      { no: 43, serial: "824186", controlType: "CS82", type: "E-82", commissioningDate: "10/24/2013", latitude: 39.2155549495545, longitude: 27.9661269488356 },
      { no: 44, serial: "824187", controlType: "CS82", type: "E-82", commissioningDate: "10/22/2013", latitude: 39.213903173689, longitude: 27.9685025157938 },
      { no: 45, serial: "824184", controlType: "CS82", type: "E-82", commissioningDate: "12/24/2013", latitude: 39.1907511462557, longitude: 27.9614218179729 },
      { no: 46, serial: "824183", controlType: "CS82", type: "E-82", commissioningDate: "12/24/2013", latitude: 39.1910564647042, longitude: 27.9648187183437 },
      { no: 47, serial: "824181", controlType: "CS82", type: "E-82", commissioningDate: "11/11/2013", latitude: 39.2045932499026, longitude: 27.9424893755334 },
      { no: 48, serial: "824182", controlType: "CS82", type: "E-82", commissioningDate: "11/13/2013", latitude: 39.2005561005434, longitude: 27.9425280705915 }
    ],
    '3213': [
      { no: 1, serial: "481542", controlType: "CS48", type: "E-48", commissioningDate: "12/22/2008", latitude: 36.780487, longitude: 27.695961 },
      { no: 2, serial: "450149", controlType: "CS48", type: "E-44", commissioningDate: "12/23/2008", latitude: 36.780534, longitude: 27.69701 },
      { no: 3, serial: "450150", controlType: "CS48", type: "E-44", commissioningDate: "12/26/2008", latitude: 36.780699, longitude: 27.700233 },
      { no: 4, serial: "450151", controlType: "CS48", type: "E-44", commissioningDate: "12/26/2008", latitude: 36.781012, longitude: 27.701383 },
      { no: 5, serial: "450152", controlType: "CS48", type: "E-44", commissioningDate: "12/27/2008", latitude: 36.781099, longitude: 27.708263 },
      { no: 6, serial: "450153", controlType: "CS48", type: "E-44", commissioningDate: "12/27/2008", latitude: 36.781864, longitude: 27.708771 },
      { no: 7, serial: "450154", controlType: "CS48", type: "E-44", commissioningDate: "12/29/2008", latitude: 36.783192, longitude: 27.712208 },
      { no: 8, serial: "481554", controlType: "CS48", type: "E-48", commissioningDate: "11/14/2008", latitude: 36.776487, longitude: 27.729519 },
      { no: 9, serial: "481561", controlType: "CS48", type: "E-48", commissioningDate: "11/14/2008", latitude: 36.777058, longitude: 27.730258 },
      { no: 10, serial: "481543", controlType: "CS48", type: "E-48", commissioningDate: "11/14/2008", latitude: 36.777883, longitude: 27.730163 },
      { no: 11, serial: "481544", controlType: "CS48", type: "E-48", commissioningDate: "11/14/2008", latitude: 36.778467, longitude: 27.730966 },
      { no: 12, serial: "481545", controlType: "CS48", type: "E-48", commissioningDate: "11/14/2008", latitude: 36.779448, longitude: 27.731681 },
      { no: 13, serial: "481546", controlType: "CS48", type: "E-48", commissioningDate: "11/12/2008", latitude: 36.777269, longitude: 27.741375 },
      { no: 14, serial: "481547", controlType: "CS48", type: "E-48", commissioningDate: "11/12/2008", latitude: 36.777771, longitude: 27.742306 },
      { no: 15, serial: "481548", controlType: "CS48", type: "E-48", commissioningDate: "11/12/2008", latitude: 36.778299, longitude: 27.743309 },
      { no: 16, serial: "481549", controlType: "CS48", type: "E-48", commissioningDate: "11/12/2008", latitude: 36.77861, longitude: 27.74431 },
      { no: 17, serial: "481550", controlType: "CS48", type: "E-48", commissioningDate: "11/12/2008", latitude: 36.778879, longitude: 27.74536 },
      { no: 18, serial: "481551", controlType: "CS48", type: "E-48", commissioningDate: "11/13/2008", latitude: 36.779423, longitude: 27.746166 },
      { no: 19, serial: "481552", controlType: "CS48", type: "E-48", commissioningDate: "11/13/2008", latitude: 36.78006, longitude: 27.747324 },
      { no: 20, serial: "481553", controlType: "CS48", type: "E-48", commissioningDate: "11/13/2008", latitude: 36.780409, longitude: 27.748364 },
      { no: 21, serial: "450155", controlType: "CS48", type: "E-44", commissioningDate: "11/13/2008", latitude: 36.78125, longitude: 27.748547 },
      { no: 22, serial: "481555", controlType: "CS48", type: "E-48", commissioningDate: "11/13/2008", latitude: 36.782521, longitude: 27.748473 },
      { no: 23, serial: "481556", controlType: "CS48", type: "E-48", commissioningDate: "12/1/2008", latitude: 36.782398, longitude: 27.752572 },
      { no: 24, serial: "481557", controlType: "CS48", type: "E-48", commissioningDate: "12/3/2008", latitude: 36.783204, longitude: 27.752673 },
      { no: 25, serial: "481558", controlType: "CS48", type: "E-48", commissioningDate: "12/2/2008", latitude: 36.783775, longitude: 27.753468 },
      { no: 26, serial: "481559", controlType: "CS48", type: "E-48", commissioningDate: "12/2/2008", latitude: 36.784257, longitude: 27.754613 },
      { no: 27, serial: "481560", controlType: "CS48", type: "E-48", commissioningDate: "12/3/2008", latitude: 36.784584, longitude: 27.756175 },
      { no: 28, serial: "450156", controlType: "CS48", type: "E-44", commissioningDate: "12/3/2008", latitude: 36.785942, longitude: 27.756489 },
      { no: 29, serial: "481562", controlType: "CS48", type: "E-48", commissioningDate: "12/15/2008", latitude: 36.779276, longitude: 27.758433 },
      { no: 30, serial: "481563", controlType: "CS48", type: "E-48", commissioningDate: "12/15/2008", latitude: 36.780168, longitude: 27.758747 },
      { no: 31, serial: "481564", controlType: "CS48", type: "E-48", commissioningDate: "12/16/2008", latitude: 36.781595, longitude: 27.759628 },
      { no: 32, serial: "481565", controlType: "CS48", type: "E-48", commissioningDate: "12/16/2008", latitude: 36.782656, longitude: 27.761471 },
      { no: 33, serial: "481566", controlType: "CS48", type: "E-48", commissioningDate: "12/19/2008", latitude: 36.783681, longitude: 27.762638 },
      { no: 34, serial: "481567", controlType: "CS48", type: "E-48", commissioningDate: "12/20/2008", latitude: 36.783903, longitude: 27.765184 },
      { no: 35, serial: "481568", controlType: "CS48", type: "E-48", commissioningDate: "12/22/2008", latitude: 36.782166, longitude: 27.768829 },
      { no: 36, serial: "481569", controlType: "CS48", type: "E-48", commissioningDate: "10/8/2008", latitude: 36.782921, longitude: 27.769004 }
    ],
    '3243': [
      { no: 1, serial: "821050", controlType: "CS82", type: "E-82", commissioningDate: "6/9/2009", latitude: 39.886582, longitude: 26.195247 },
      { no: 2, serial: "821051", controlType: "CS82", type: "E-82", commissioningDate: "6/9/2009", latitude: 39.887223, longitude: 26.193553 },
      { no: 3, serial: "821052", controlType: "CS82", type: "E-82", commissioningDate: "6/8/2009", latitude: 39.888063, longitude: 26.192022 },
      { no: 4, serial: "821053", controlType: "CS82", type: "E-82", commissioningDate: "6/7/2009", latitude: 39.887252, longitude: 26.187299 },
      { no: 5, serial: "821054", controlType: "CS82", type: "E-82", commissioningDate: "6/12/2009", latitude: 39.887419, longitude: 26.185328 },
      { no: 6, serial: "821055", controlType: "CS82", type: "E-82", commissioningDate: "6/11/2009", latitude: 39.886633, longitude: 26.180889 },
      { no: 7, serial: "821056", controlType: "CS82", type: "E-82", commissioningDate: "6/7/2009", latitude: 39.887496, longitude: 26.179271 },
      { no: 8, serial: "821057", controlType: "CS82", type: "E-82", commissioningDate: "6/8/2009", latitude: 39.888409, longitude: 26.177709 },
      { no: 9, serial: "821058", controlType: "CS82", type: "E-82", commissioningDate: "6/7/2009", latitude: 39.889544, longitude: 26.176517 },
      { no: 10, serial: "821059", controlType: "CS82", type: "E-82", commissioningDate: "6/6/2009", latitude: 39.890506, longitude: 26.175076 },
      { no: 11, serial: "481675", controlType: "CS48", type: "E-48", commissioningDate: "6/11/2009", latitude: 39.888799, longitude: 26.190219 }
    ],
    '3245': [
      { no: 1, serial: "450228", controlType: "CS48", type: "E-44", commissioningDate: "7/10/2009", latitude: 39.95601, longitude: 28.05464 },
      { no: 2, serial: "450229", controlType: "CS48", type: "E-44", commissioningDate: "7/10/2009", latitude: 39.95646, longitude: 28.05373 },
      { no: 3, serial: "450230", controlType: "CS48", type: "E-44", commissioningDate: "7/11/2009", latitude: 39.95675, longitude: 28.05268 },
      { no: 4, serial: "450231", controlType: "CS48", type: "E-44", commissioningDate: "7/11/2009", latitude: 39.957, longitude: 28.05167 },
      { no: 5, serial: "450232", controlType: "CS48", type: "E-44", commissioningDate: "7/12/2009", latitude: 39.95728, longitude: 28.05071 },
      { no: 6, serial: "450233", controlType: "CS48", type: "E-44", commissioningDate: "7/12/2009", latitude: 39.95977, longitude: 28.0507 },
      { no: 7, serial: "450234", controlType: "CS48", type: "E-44", commissioningDate: "7/13/2009", latitude: 39.96018, longitude: 28.04979 },
      { no: 8, serial: "450235", controlType: "CS48", type: "E-44", commissioningDate: "7/20/2009", latitude: 39.96074, longitude: 28.04857 },
      { no: 9, serial: "450236", controlType: "CS48", type: "E-44", commissioningDate: "7/13/2009", latitude: 39.96113, longitude: 28.04751 },
      { no: 10, serial: "450237", controlType: "CS48", type: "E-44", commissioningDate: "7/14/2009", latitude: 39.96152, longitude: 28.04645 },
      { no: 11, serial: "450238", controlType: "CS48", type: "E-44", commissioningDate: "7/14/2009", latitude: 39.96189, longitude: 28.0456 },
      { no: 12, serial: "450239", controlType: "CS48", type: "E-44", commissioningDate: "7/15/2009", latitude: 39.96248, longitude: 28.04477 },
      { no: 13, serial: "450240", controlType: "CS48", type: "E-44", commissioningDate: "7/15/2009", latitude: 39.96325, longitude: 28.04406 },
      { no: 14, serial: "450241", controlType: "CS48", type: "E-44", commissioningDate: "7/16/2009", latitude: 39.96372, longitude: 28.04315 },
      { no: 15, serial: "450242", controlType: "CS48", type: "E-44", commissioningDate: "7/16/2009", latitude: 39.96418, longitude: 28.04222 },
      { no: 16, serial: "450243", controlType: "CS48", type: "E-44", commissioningDate: "7/17/2009", latitude: 39.96464, longitude: 28.0413 },
      { no: 17, serial: "450244", controlType: "CS48", type: "E-44", commissioningDate: "7/17/2009", latitude: 39.96498, longitude: 28.04026 },
      { no: 18, serial: "450245", controlType: "CS48", type: "E-44", commissioningDate: "7/18/2009", latitude: 39.96556, longitude: 28.03944 },
      { no: 19, serial: "450246", controlType: "CS48", type: "E-44", commissioningDate: "7/18/2009", latitude: 39.96602, longitude: 28.03852 },
      { no: 20, serial: "450247", controlType: "CS48", type: "E-44", commissioningDate: "7/19/2009", latitude: 39.9665, longitude: 28.03769 },
      { no: 21, serial: "450248", controlType: "CS48", type: "E-44", commissioningDate: "7/19/2009", latitude: 39.96697, longitude: 28.03684 },
      { no: 22, serial: "450249", controlType: "CS48", type: "E-44", commissioningDate: "11/5/2009", latitude: 39.96747, longitude: 28.036 },
      { no: 23, serial: "450250", controlType: "CS48", type: "E-44", commissioningDate: "11/6/2009", latitude: 39.96797, longitude: 28.03516 },
      { no: 24, serial: "784442", controlType: "CS82", type: "E-70", commissioningDate: "11/13/2014", latitude: 39.95309, longitude: 28.04832 },
      { no: 25, serial: "784443", controlType: "CS82", type: "E-70", commissioningDate: "12/28/2016", latitude: 39.95501, longitude: 28.05954 },
      { no: 26, serial: "784444", controlType: "CS82", type: "E-70", commissioningDate: "12/20/2016", latitude: 39.95548, longitude: 28.05682 },
      { no: 27, serial: "784445", controlType: "CS82", type: "E-70", commissioningDate: "12/15/2016", latitude: 39.9518, longitude: 28.05409 }
    ],
    '3439': [
      { no: 1, serial: "821500", controlType: "CS82", type: "E-82", commissioningDate: "10/13/2009", latitude: 40.638, longitude: 27.01226 },
      { no: 2, serial: "821501", controlType: "CS82", type: "E-82", commissioningDate: "10/11/2009", latitude: 40.63693, longitude: 27.0137 },
      { no: 3, serial: "821503", controlType: "CS82", type: "E-82", commissioningDate: "10/11/2009", latitude: 40.6319, longitude: 27.00674 },
      { no: 4, serial: "821502", controlType: "CS82", type: "E-82", commissioningDate: "10/10/2009", latitude: 40.63315, longitude: 27.00534 },
      { no: 5, serial: "782464", controlType: "CS82", type: "E-70", commissioningDate: "10/11/2009", latitude: 40.62769, longitude: 26.99738 },
      { no: 6, serial: "782465", controlType: "CS82", type: "E-70", commissioningDate: "10/12/2009", latitude: 40.62684, longitude: 26.99938 },
      { no: 7, serial: "821504", controlType: "CS82", type: "E-82", commissioningDate: "10/17/2009", latitude: 40.60782, longitude: 26.98064 },
      { no: 8, serial: "821505", controlType: "CS82", type: "E-82", commissioningDate: "10/10/2009", latitude: 40.6149, longitude: 26.99298 },
      { no: 9, serial: "821506", controlType: "CS82", type: "E-82", commissioningDate: "10/10/2009", latitude: 40.61379, longitude: 26.99451 },
      { no: 10, serial: "821507", controlType: "CS82", type: "E-82", commissioningDate: "10/12/2009", latitude: 40.61013, longitude: 26.97767 },
      { no: 11, serial: "821508", controlType: "CS82", type: "E-82", commissioningDate: "10/14/2009", latitude: 40.60893, longitude: 26.97917 },
      { no: 12, serial: "782466", controlType: "CS82", type: "E-70", commissioningDate: "10/15/2009", latitude: 40.60532, longitude: 26.9833 },
      { no: 13, serial: "782467", controlType: "CS82", type: "E-70", commissioningDate: "10/15/2009", latitude: 40.60664, longitude: 26.98212 },
      { no: 14, serial: "821509", controlType: "CS82", type: "E-82", commissioningDate: "10/19/2009", latitude: 40.60436, longitude: 26.98517 },
      { no: 15, serial: "481743", controlType: "CS48", type: "E-48", commissioningDate: "10/11/2009", latitude: 40.62097, longitude: 26.99739 }
    ],
    '3793': [
      { no: 1, serial: "782734", controlType: "CS82", type: "E-70", commissioningDate: "12/8/2010", latitude: 39.30813, longitude: 27.9335 },
      { no: 2, serial: "450522", controlType: "CS48", type: "E-44", commissioningDate: "12/21/2010", latitude: 39.3064, longitude: 27.9345 },
      { no: 3, serial: "782735", controlType: "CS82", type: "E-70", commissioningDate: "12/9/2010", latitude: 39.31742, longitude: 27.95 },
      { no: 4, serial: "782736", controlType: "CS82", type: "E-70", commissioningDate: "12/21/2010", latitude: 39.3155, longitude: 27.9511 },
      { no: 5, serial: "782737", controlType: "CS82", type: "E-70", commissioningDate: "12/9/2010", latitude: 39.31386, longitude: 27.95271 },
      { no: 6, serial: "782738", controlType: "CS82", type: "E-70", commissioningDate: "12/20/2010", latitude: 39.3119, longitude: 27.95432 },
      { no: 7, serial: "782739", controlType: "CS82", type: "E-70", commissioningDate: "12/21/2010", latitude: 39.31107, longitude: 27.95583 },
      { no: 8, serial: "782731", controlType: "CS82", type: "E-70", commissioningDate: "11/10/2010", latitude: 39.26967, longitude: 27.87662 },
      { no: 9, serial: "782732", controlType: "CS82", type: "E-70", commissioningDate: "12/9/2010", latitude: 39.29948, longitude: 27.9179 },
      { no: 10, serial: "782733", controlType: "CS82", type: "E-70", commissioningDate: "12/9/2010", latitude: 39.29929, longitude: 27.91581 },
      { no: 11, serial: "450521", controlType: "CS48", type: "E-44", commissioningDate: "12/21/2010", latitude: 39.29905, longitude: 27.91731 },
      { no: 12, serial: "782730", controlType: "CS82", type: "E-70", commissioningDate: "11/9/2010", latitude: 39.27086, longitude: 27.87535 },
      { no: 13, serial: "782729", controlType: "CS82", type: "E-70", commissioningDate: "11/8/2010", latitude: 39.27225, longitude: 27.87402 },
      { no: 14, serial: "782728", controlType: "CS82", type: "E-70", commissioningDate: "12/20/2010", latitude: 39.27271, longitude: 27.87166 },
      { no: 15, serial: "921207", controlType: "CS82", type: "E-92", commissioningDate: "7/22/2017", latitude: 39.30872, longitude: 27.92751 },
      { no: 16, serial: "921205", controlType: "CS82", type: "E-92", commissioningDate: "8/24/2017", latitude: 39.2737, longitude: 27.87822 },
      { no: 17, serial: "921206", controlType: "CS82", type: "E-92", commissioningDate: "8/15/2017", latitude: 39.29971, longitude: 27.92928 },
      { no: 18, serial: "921208", controlType: "CS82", type: "E-92", commissioningDate: "8/1/2017", latitude: 39.30275, longitude: 27.92032 },
      { no: 19, serial: "826325", controlType: "CS82", type: "E-82", commissioningDate: "9/8/2015", latitude: 39.31554, longitude: 27.94256 },
      { no: 20, serial: "826326", controlType: "CS82", type: "E-82", commissioningDate: "9/12/2015", latitude: 39.31386, longitude: 27.92405 },
      { no: 21, serial: "826327", controlType: "CS82", type: "E-82", commissioningDate: "8/26/2015", latitude: 39.26825, longitude: 27.88153 },
      { no: 22, serial: "826328", controlType: "CS82", type: "E-82", commissioningDate: "8/27/2015", latitude: 39.2719, longitude: 27.88253 },
      { no: 23, serial: "826329", controlType: "CS82", type: "E-82", commissioningDate: "8/28/2015", latitude: 39.27352, longitude: 27.86755 }
    ],
    '3892': [
      { no: 1, serial: "822191", controlType: "CS82", type: "E-82", commissioningDate: "4/11/2011", latitude: 39.5198159, longitude: 27.1397559 },
      { no: 2, serial: "822192", controlType: "CS82", type: "E-82", commissioningDate: "4/10/2011", latitude: 39.5181442, longitude: 27.1404092 },
      { no: 3, serial: "822193", controlType: "CS82", type: "E-82", commissioningDate: "4/12/2011", latitude: 39.516956, longitude: 27.1413729 },
      { no: 4, serial: "822194", controlType: "CS82", type: "E-82", commissioningDate: "4/18/2011", latitude: 39.5257604, longitude: 27.1412205 },
      { no: 5, serial: "822195", controlType: "CS82", type: "E-82", commissioningDate: "4/16/2011", latitude: 39.5244187, longitude: 27.1418565 },
      { no: 6, serial: "822196", controlType: "CS82", type: "E-82", commissioningDate: "4/16/2011", latitude: 39.5186319, longitude: 27.1545689 },
      { no: 7, serial: "822197", controlType: "CS82", type: "E-82", commissioningDate: "4/19/2011", latitude: 39.5181439, longitude: 27.1566309 },
      { no: 8, serial: "822198", controlType: "CS82", type: "E-82", commissioningDate: "4/17/2011", latitude: 39.5170593, longitude: 27.157918 },
      { no: 9, serial: "921532", controlType: "CS82", type: "E-92", commissioningDate: "3/1/2019", latitude: 39.5154225, longitude: 27.1423568 },
      { no: 10, serial: "921533", controlType: "CS82", type: "E-92", commissioningDate: "2/2/2019", latitude: 39.520859, longitude: 27.1519241 },
      { no: 11, serial: "921534", controlType: "CS82", type: "E-92", commissioningDate: "2/15/2019", latitude: 39.521241, longitude: 27.156673 },
      { no: 12, serial: "921535", controlType: "CS82", type: "E-92", commissioningDate: "2/15/2019", latitude: 39.5216239, longitude: 27.1614223 },
      { no: 13, serial: "921536", controlType: "CS82", type: "E-92", commissioningDate: "2/6/2019", latitude: 39.5188588, longitude: 27.1606098 }
    ]
  };

  constructor() {
    const extraData: Record<string, { label: string, serial: string, latitude?: number, longitude?: number, controlType?: string, type?: string, commissioningDate?: string }[]> = {
      '0752': [{ label: 'RTU', serial: '9162314', latitude: 38.30506, longitude: 26.46284, controlType: 'RTU', type: 'RTU' }],
      '2678': [
        { label: 'RTU', serial: '9163120', latitude: 38.288352, longitude: 26.485594, controlType: 'RTU', type: 'RTU' },
        { label: 'FCU', serial: '9150279', latitude: 38.288058, longitude: 26.485789, controlType: 'FCU', type: 'FCU', commissioningDate: '11/22/2016' },
        { label: 'SAI', serial: '9143576', latitude: 38.288259, longitude: 26.485853, controlType: 'SAI', type: 'SAI' }
      ],
      '2688': [
        { label: 'RTU', serial: '9161468', latitude: 40.030863, longitude: 26.404232, controlType: 'RTU', type: 'RTU', commissioningDate: '3/16/2014' },
        { label: 'FCU', serial: '9150397', latitude: 40.030772, longitude: 26.404051, controlType: 'FCU', type: 'FCU', commissioningDate: '5/12/2016' },
        { label: 'SAI', serial: '9143506', latitude: 40.031052, longitude: 26.403953, controlType: 'SAI', type: 'SAI' }
      ],
      '2990': [{ label: 'RTU', serial: '9160744', latitude: 39.198297, longitude: 27.963086, controlType: 'RTU', type: 'RTU', commissioningDate: '3/20/2014' }],
      '3213': [{ label: 'RTU', serial: '9162990', controlType: 'RTU', type: 'RTU' }],
      '3243': [
        { label: 'FCU', serial: '9150523', latitude: 39.887134, longitude: 26.178417, controlType: 'FCU', type: 'FCU' },
        { label: 'SAI', serial: '9143647', latitude: 39.887208, longitude: 26.178446, controlType: 'SAI', type: 'SAI' }
      ],
      '3245': [{ label: 'RTU', serial: '9161653', latitude: 39.956645, longitude: 28.050328, controlType: 'RTU', type: 'RTU' }],
      '3439': [{ label: 'RTU', serial: '9164676', latitude: 40.620922, longitude: 26.992456, controlType: 'RTU', type: 'RTU' }],
      '3793': [
        { label: 'FCU', serial: '9150269', latitude: 39.29283, longitude: 27.91169, controlType: 'FCU', type: 'FCU' },
        { label: 'SAI', serial: '9143334', latitude: 39.29283, longitude: 27.91169, controlType: 'SAI', type: 'SAI' }
      ],
      '3892': [
        { label: 'FCU', serial: '9150550', latitude: 39.5217763, longitude: 27.1403855, controlType: 'FCU', type: 'FCU' },
        { label: 'SAI', serial: '9143702', latitude: 39.5217763, longitude: 27.1403855, controlType: 'SAI', type: 'SAI' }
      ]
    };

    Object.keys(extraData).forEach(siteId => {
      if (this.turbineData[siteId]) {
        extraData[siteId].forEach(extra => {
          this.turbineData[siteId].push({
            no: 0,
            serial: extra.serial,
            label: extra.label,
            latitude: extra.latitude,
            longitude: extra.longitude,
            controlType: extra.controlType,
            type: extra.type,
            commissioningDate: extra.commissioningDate
          });
        });
      }
    });
  }

  getSites(): Site[] {
    const user = (window as any).currentUser;
    let result = this.sites;
    if (user && user.role === 'TECHNICIAN') {
      const teamStr = (user.displayName || '').replace(/\s+/g, '').toLowerCase();
      const teamMapping: Record<string, string[]> = {
        'team01': ['2678', '0752'],
        'team1': ['2678', '0752'],
        'team02': ['2678', '0752'],
        'team2': ['2678', '0752'],
        'team12': ['2678', '0752'],
        'team03': ['2688', '3439', '3243'],
        'team3': ['2688', '3439', '3243'],
        'team04': ['2688', '3439', '3243'],
        'team4': ['2688', '3439', '3243'],
        'team13': ['2688', '3439', '3243'],
        'team15': ['2688', '3439', '3243'],
        'team06': ['2990', '3793'],
        'team6': ['2990', '3793'],
        'team08': ['2990', '3793'],
        'team8': ['2990', '3793'],
        'team09': ['2990', '3793'],
        'team9': ['2990', '3793'],
        'team14': ['2990', '3793'],
        'team05': ['3213'],
        'team5': ['3213'],
        'team10': ['3213'],
        'team07': ['3245', '3892'],
        'team7': ['3245', '3892'],
        'team11': ['3245', '3892']
      };

      if (user.allowedSites && Array.isArray(user.allowedSites) && user.allowedSites.length > 0) {
        result = this.sites.filter(s => user.allowedSites.includes(s.id));
      } else {
        const allowedIds = teamMapping[teamStr];
        if (allowedIds) {
          result = this.sites.filter(s => allowedIds.includes(s.id));
        }
      }
    }
    
    return result.sort((a, b) => {
      const indexA = DataService.customOrder.findIndex(o => o.toLowerCase() === a.name.toLowerCase());
      const indexB = DataService.customOrder.findIndex(o => o.toLowerCase() === b.name.toLowerCase());
      if (indexA === -1 && indexB === -1) return a.name.localeCompare(b.name);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }

  getAllowedTeams(): string[] {
    const user = (window as any).currentUser;
    const isAdmin = user?.role?.toUpperCase() === 'ADMIN';
    const allTeams = Array.from({length: 15}, (_, i) => `Team ${String(i + 1).padStart(2, '0')}`);
    
    if (isAdmin) return allTeams;

    const allowedSites = this.getSites().map(s => s.id);
    
    const teamMapping: Record<string, string[]> = {
      'Team 01': ['2678', '0752'],
      'Team 02': ['2678', '0752'],
      'Team 12': ['2678', '0752'],
      
      'Team 03': ['2688', '3439', '3243'],
      'Team 04': ['2688', '3439', '3243'],
      'Team 13': ['2688', '3439', '3243'],
      'Team 15': ['2688', '3439', '3243'],

      'Team 06': ['2990', '3793'],
      'Team 08': ['2990', '3793'],
      'Team 09': ['2990', '3793'],
      'Team 14': ['2990', '3793'],

      'Team 05': ['3213'],
      'Team 10': ['3213'],

      'Team 07': ['3245', '3892'],
      'Team 11': ['3245', '3892']
    };

    return allTeams.filter(team => {
      const teamSites = teamMapping[team] || [];
      return teamSites.some(siteId => allowedSites.includes(siteId));
    });
  }

  getWarehouses(): Warehouse[] {
    return this.warehouses;
  }

  getTurbinesBySite(siteId: string): Turbine[] {
    const rawData = this.turbineData[siteId] || [];
    return rawData.map(d => ({
      id: d.serial,
      siteId,
      no: d.no,
      status: 'online', 
      label: d.label,
      latitude: d.latitude,
      longitude: d.longitude,
      controlType: d.controlType,
      commissioningDate: d.commissioningDate,
      type: d.type
    }));
  }

  getStats() {
    let total = 0;
    this.sites.forEach(s => total += s.turbineCount);
    
    const activeFaults = Math.floor(total * 0.05);
    const maintenance = Math.floor(total * 0.03);
    const operational = total - activeFaults - maintenance;
    
    return {
      total,
      activeFaults,
      maintenance,
      operational
    };
  }

  getWarehouseIdBySiteId(siteId: string): string | null {
    return this.siteToWarehouseMap[siteId] || null;
  }

  findTurbineBySerial(serial: string, targetSiteId?: string) {
    if (!serial) return undefined;
    const cleanSearch = String(serial).toLowerCase().trim();
    
    for (const [siteId, turbines] of Object.entries(this.turbineData)) {
      if (targetSiteId && siteId !== targetSiteId) continue;
      
      const turbine = turbines.find(t => {
        const tSerial = String(t.serial || '').toLowerCase().trim();
        const tLabel = String(t.label || '').toLowerCase().trim();
        const tNo = String(t.no || '').toLowerCase().trim();
        
        const tNoPad = tNo.padStart(2, '0');
        
        const tNoFormatted = `t-${tNo}`;
        const tNoFormatted2 = `t${tNo}`;
        const tNoFormattedPad = `t-${tNoPad}`;
        const tNoFormattedPad2 = `t${tNoPad}`;
        
        return tSerial === cleanSearch || 
               (tLabel && tLabel === cleanSearch) ||
               tNo === cleanSearch ||
               tNoPad === cleanSearch ||
               tNoFormatted === cleanSearch ||
               tNoFormatted2 === cleanSearch ||
               tNoFormattedPad === cleanSearch ||
               tNoFormattedPad2 === cleanSearch;
      });
      if (turbine) {
        const site = this.sites.find(s => s.id === siteId);
        return {
          turbineNo: turbine.label || `T${turbine.no.toString().padStart(2, '0')}`,
          siteId,
          siteName: site?.name || '',
          latitude: turbine.latitude,
          longitude: turbine.longitude,
          controlType: turbine.controlType,
          commissioningDate: turbine.commissioningDate,
          type: turbine.type
        };
      }
    }
    return null;
  }

  resolveName(id: string): string {
    const warehouse = this.warehouses.find(w => w.id === id);
    if (warehouse) return warehouse.name;
    const site = this.sites.find(s => s.id === id);
    if (site) return site.name;
    return id;
  }
}

export const dataService = new DataService();
