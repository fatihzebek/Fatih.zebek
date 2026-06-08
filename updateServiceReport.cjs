const fs = require('fs');

let code = fs.readFileSync('src/services/ServiceReportService.ts', 'utf8');

// Add isDownloaded to ServiceReport interface
if (!code.includes('isDownloaded?: boolean;')) {
    code = code.replace(
        '  isOffline?: boolean;',
        '  isOffline?: boolean;\n  isDownloaded?: boolean;'
    );
}

// Add markAsDownloaded method
if (!code.includes('markAsDownloaded')) {
    const methodStr = `
  async markAsDownloaded(reportIds: string[]) {
    try {
      const promises = reportIds.map(id => {
        const docRef = doc(db, 'serviceReports', id);
        return updateDoc(docRef, { isDownloaded: true });
      });
      await Promise.all(promises);
    } catch (error) {
      console.error("Error marking reports as downloaded: ", error);
      throw error;
    }
  }
`;
    // Insert before the last closing brace of the class
    const classEndIndex = code.lastIndexOf('}');
    code = code.substring(0, classEndIndex) + methodStr + code.substring(classEndIndex);
}

fs.writeFileSync('src/services/ServiceReportService.ts', code, 'utf8');
console.log('Updated ServiceReportService');
