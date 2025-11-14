import React from 'react';
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";

// Export to CSV
export const exportToCSV = (data, filename) => {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      if (typeof value === 'string' && value.includes(',')) return `"${value}"`;
      if (typeof value === 'object') return JSON.stringify(value);
      return value;
    }).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

// Export to PDF (using browser print to PDF)
export const exportToPDF = (elementId, filename) => {
  const element = document.getElementById(elementId);
  if (!element) {
    alert('Report not found');
    return;
  }

  // Use browser's print functionality which allows saving as PDF
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>${filename}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
          h1, h2, h3 { color: #333; }
          .summary { background: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 5px; }
          @media print {
            body { margin: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        ${element.innerHTML}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 100);
          }
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

// Component for export buttons
export default function ReportExporter({ data, filename, title }) {
  return (
    <div className="flex gap-2">
      <Button 
        size="sm" 
        variant="outline"
        onClick={() => exportToCSV(data, filename)}
      >
        <Download className="w-4 h-4 mr-2" />
        CSV
      </Button>
      <Button 
        size="sm" 
        variant="outline"
        onClick={() => window.print()}
      >
        <FileText className="w-4 h-4 mr-2" />
        PDF
      </Button>
    </div>
  );
}