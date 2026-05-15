import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// ============================================
// 🛡️ PRIVATE HELPERS
// ============================================

const sanitizeCellForCSV = (val) => {
  if (val === null || val === undefined) return '';
  return String(val).replace(/"/g, '""');
};

const sanitizeCellForPDF = (val) => {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/₹/g, 'Rs. ')
    .replace(/रू/g, 'Rs. ')
    .replace(/\$/g, 'USD ');
};

const isNumericColumn = (col) => {
  const key = String(col.key).toLowerCase();
  return col.isNumeric || key.includes('amount') || key.includes('fee') || key.includes('balance') || key.includes('net');
};

const validateInput = (data, columns, fileName) => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    throw new Error("No data available to download.");
  }
  if (!columns || !Array.isArray(columns) || columns.length === 0) {
    throw new Error("Columns configuration is missing.");
  }
  if (!fileName) {
    throw new Error("File name is required.");
  }
};

// ============================================
// 📊 1. DOWNLOAD AS EXCEL (Smart CSV with BOM)
// ============================================
export const downloadExcelReport = async (
  data,
  columns,
  fileName,
  reportTitle = "Financial Report",
  { onError, onSuccess } = {}
) => {
  try {
    validateInput(data, columns, fileName);

    // 1. Headers
    const headers = columns.map(col => `"${sanitizeCellForCSV(col.header)}"`).join(',');

    // 2. Rows & dynamic totals
    let totals = new Array(columns.length).fill("");
    totals[0] = "TOTAL";

    const rows = data.map(row => {
      return columns.map((col, index) => {
        let val = sanitizeCellForCSV(row[col.key]);

        // Summing for numeric columns
        if (isNumericColumn(col)) {
          const numVal = parseFloat(String(val).replace(/[^0-9.-]+/g, ""));
          if (!isNaN(numVal)) {
            totals[index] = (totals[index] === "" ? 0 : totals[index]) + numVal;
          }
        }
        return `"${val}"`;
      }).join(',');
    });

    // 3. Format totals row
    const totalsRow = totals.map((t, index) => {
      if (typeof t === 'number') return `"${t.toFixed(2)}"`;
      if (index === 0) return `"${t}"`;
      return `""`;
    }).join(',');

    // 4. Assemble CSV
    const csvContent = [
      `"${reportTitle.toUpperCase()}"`,
      `"Generated on: ${new Date().toLocaleString()}"`,
      `""`,
      headers,
      ...rows,
      totalsRow
    ].join('\n');

    // 5. Trigger download
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${fileName}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (onSuccess) onSuccess();
  } catch (error) {
    console.error("Excel Generation Error:", error);
    if (onError) onError(error.message);
    else throw error; // re-throw agar koi listener nahi
  }
};

// ============================================
// 📄 2. DOWNLOAD PRO PDF
// ============================================
export const downloadPDFReport = async (
  data,
  columns,
  fileName,
  reportTitle = "Financial Report",
  { onError, onSuccess } = {}
) => {
  try {
    validateInput(data, columns, fileName);

    const doc = new jsPDF();

    // Header
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

    const body = data.map(row =>
      columns.map((col, index) => {
        let cellValue = sanitizeCellForPDF(row[col.key]);

        // Summing for numeric columns
        if (isNumericColumn(col)) {
          const numVal = parseFloat(String(cellValue).replace(/[^0-9.-]+/g, ""));
          if (!isNaN(numVal)) {
            totals[index] = (totals[index] === "" ? 0 : totals[index]) + numVal;
          }
        }
        return cellValue;
      })
    );

    // Format totals for final row with currency symbol (use first row's symbol)
    const firstRowSymbol = body.length > 0 ? (String(body[0][0]).includes('Rs.') ? 'Rs. ' : String(body[0][0]).includes('USD') ? 'USD ' : '') : '';
    totals = totals.map((t, i) => {
      if (typeof t === 'number') {
        return `${firstRowSymbol}${t.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
      return t;
    });
    body.push(totals);

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

    if (onSuccess) onSuccess();
  } catch (error) {
    console.error("PDF Error:", error);
    if (onError) onError(error.message);
    else throw error;
  }
};