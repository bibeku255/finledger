import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// 📊 1. DOWNLOAD AS EXCEL (CSV)
export const downloadExcelReport = (data, columns, fileName) => {
  if (!data || data.length === 0) return alert("No data to download.");

  // Create Headers
  const headers = columns.map(col => col.header).join(',');
  
  // Create Rows (wrapping in quotes to prevent comma issues in text)
  const rows = data.map(row => {
    return columns.map(col => `"${row[col.key] || ''}"`).join(',');
  }).join('\n');

  const csvContent = `${headers}\n${rows}`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${fileName}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// 📄 2. DOWNLOAD AS PDF (100% Fixed for React/Vite)
export const downloadPDFReport = (data, columns, fileName, reportTitle) => {
  if (!data || data.length === 0) return alert("No data to download.");

  try {
    const doc = new jsPDF();
    
    // Add Title and Date
    doc.setFontSize(16);
    doc.text(reportTitle, 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

    // Map Data for AutoTable
    const head = [columns.map(col => col.header)];
    const body = data.map(row => 
      columns.map(col => {
        let cellValue = row[col.key] ? String(row[col.key]) : '';
        
        // 🚀 CRASH FIX: Standard PDF fonts don't support ₹ or रू symbols. 
        // Replacing them with "Rs." safely for the PDF output only.
        cellValue = cellValue.replace(/₹/g, 'Rs. ').replace(/रू/g, 'Rs. ');
        
        return cellValue;
      })
    );

    // 🚀 CRASH FIX: Use modern autoTable syntax (autoTable(doc, options))
    autoTable(doc, {
      head: head,
      body: body,
      startY: 28,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [59, 130, 246] }, // Tailwind Blue-600
      alternateRowStyles: { fillColor: [248, 250, 252] } // Tailwind Slate-50
    });

    doc.save(`${fileName}_${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (error) {
    console.error("PDF Generation Error:", error);
    alert("Failed to generate PDF. Please check console for details.");
  }
};