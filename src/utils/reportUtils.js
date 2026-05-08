import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// ============================================
// 📊 1. DOWNLOAD AS EXCEL (Smart CSV with BOM)
// ============================================
export const downloadExcelReport = (data, columns, fileName, reportTitle = "Financial Report") => {
  try {
    if (!data || !Array.isArray(data) || data.length === 0) {
      alert("No data available to download.");
      return;
    }

    // 1. Prepare Headers
    const headers = columns.map(col => `"${String(col.header).replace(/"/g, '""')}"`).join(',');

    // 2. Prepare Rows & Calculate Totals dynamically
    let totals = new Array(columns.length).fill("");
    totals[0] = "TOTAL";

    const rows = data.map(row => {
      return columns.map((col, index) => {
        let val = row[col.key];
        if (val === null || val === undefined) val = "";
        
        // Summing Logic for Amounts
        const colKey = String(col.key).toLowerCase();
        if (col.isNumeric || colKey.includes('amount') || colKey.includes('fee') || colKey.includes('balance') || colKey.includes('net')) {
          const numVal = parseFloat(String(val).replace(/[^0-9.-]+/g, ""));
          if (!isNaN(numVal)) {
            totals[index] = (totals[index] === "" ? 0 : totals[index]) + numVal;
          }
        }
        
        // Wrap cell value in quotes to prevent Excel column breaks on commas
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',');
    });

    // 3. Format Totals Row
    const totalsRow = totals.map((t, index) => {
      if (typeof t === 'number') return `"${t.toFixed(2)}"`;
      if (index === 0) return `"${t}"`;
      return `""`; // Empty cells for non-numeric columns
    }).join(',');

    // 4. Assemble Final CSV Content
    // Note: \uFEFF is added so Excel reads the file as UTF-8 (Fixes ₹, रू, $ corruption)
    const csvContent = [
      `"${reportTitle.toUpperCase()}"`,
      `"Generated on: ${new Date().toLocaleString()}"`,
      `""`, // Empty spacing row
      headers,
      ...rows,
      totalsRow
    ].join('\n');

    // 5. Trigger Native Download
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${fileName}_${new Date().toISOString().split('T')[0]}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (error) {
    console.error("Excel Generation Error:", error);
    alert(`Excel Error: ${error.message}`);
  }
};


// ============================================
// 📄 2. DOWNLOAD PRO PDF (Verified Working)
// ============================================
export const downloadPDFReport = (data, columns, fileName, reportTitle = "Financial Report") => {
  try {
    if (!data || !Array.isArray(data) || data.length === 0) {
      alert("No data available to download.");
      return;
    }

    const doc = new jsPDF();
    
    // Header & Branding
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 58, 138);
    doc.text(reportTitle.toUpperCase(), 14, 18);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()} | Finledger Smart Engine`, 14, 25);

    const head = [columns.map(col => col.header)];
    let totals = new Array(columns.length).fill("");
    totals[0] = "TOTAL";

    // Format Body & Calculate Totals
    const body = data.map(row => 
      columns.map((col, index) => {
        let cellValue = row[col.key];
        if (cellValue === null || cellValue === undefined) cellValue = "";
        cellValue = String(cellValue);
        
        // Remove unsupported symbols for standard PDF fonts
        cellValue = cellValue.replace(/₹/g, 'Rs. ').replace(/रू/g, 'Rs. ').replace(/\$/g, 'USD ');
        
        const colKey = String(col.key).toLowerCase();
        if (col.isNumeric || colKey.includes('amount') || colKey.includes('fee') || colKey.includes('balance') || colKey.includes('net')) {
          const numVal = parseFloat(cellValue.replace(/[^0-9.-]+/g, ""));
          if (!isNaN(numVal)) {
            totals[index] = (totals[index] === "" ? 0 : totals[index]) + numVal;
          }
        }
        return cellValue;
      })
    );

    // Format totals for bottom row
    totals = totals.map((t, i) => {
      if (typeof t === 'number') {
        const symbol = String(body[0][i]).includes('Rs.') ? 'Rs. ' : String(body[0][i]).includes('USD') ? 'USD ' : '';
        return `${symbol}${t.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
      }
      return t;
    });

    body.push(totals); 

    // Generate Table
    autoTable(doc, {
      head: head,
      body: body,
      startY: 32,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3, textColor: [51, 65, 85] },
      headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      willDrawCell: function (data) {
        if (data.section === 'body') {
          const colKey = String(columns[data.column.index].key).toLowerCase();
          if (colKey.includes('amount') || colKey.includes('fee') || colKey.includes('balance') || colKey.includes('net')) {
            data.cell.styles.halign = 'right';
          }
          if (data.row.index === body.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [241, 245, 249]; 
            data.cell.styles.textColor = [15, 23, 42];
          }
        }
      },
    });

    doc.save(`${fileName}_${new Date().toISOString().split('T')[0]}.pdf`);

  } catch (error) {
    console.error("PDF Error:", error);
    alert(`PDF Error: ${error.message}`);
  }
};