import React, { useState, useRef } from 'react';
import { FullDashboardPayload } from '../../types';
import * as XLSX from 'xlsx';
import { X, Upload, RotateCcw, Download, CheckCircle2, AlertCircle } from 'lucide-react';

interface DataImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportData: (payload: FullDashboardPayload) => void;
  onResetToDemo: () => void;
  currentData: FullDashboardPayload;
}

export const DataImportModal: React.FC<DataImportModalProps> = ({
  isOpen,
  onClose,
  onImportData,
  onResetToDemo,
  currentData
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<{ msg: string; isError?: boolean } | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.json')) {
      reader.onload = evt => {
        try {
          const parsed = JSON.parse(evt.target?.result as string);
          if (parsed && parsed.meta && parsed.demand) {
            onImportData(parsed);
            setImportStatus({ msg: `Successfully imported JSON dataset (${file.name})` });
          } else {
            setImportStatus({ msg: 'Invalid JSON schema: Missing meta or demand fields', isError: true });
          }
        } catch (err: any) {
          setImportStatus({ msg: 'Failed to parse JSON file: ' + err.message, isError: true });
        }
      };
      reader.readAsText(file);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      reader.onload = evt => {
        try {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          // Check if it contains multiple sheets or comments sheet
          const sheetNames = workbook.SheetNames;
          if (sheetNames.includes('Comments')) {
            const commentsSheet = workbook.Sheets['Comments'];
            const jsonComments = XLSX.utils.sheet_to_json<any>(commentsSheet);
            
            const importedComments = jsonComments.map((r, idx) => ({
              id: r['ID'] || r['id'] || `C${String(idx + 1).padStart(4, '0')}`,
              created: r['Created'] || r['created'] || new Date().toISOString().slice(0, 19).replace('T', ' '),
              updated: r['Last Updated'] || r['updated'] || new Date().toISOString().slice(0, 19).replace('T', ' '),
              part: String(r['Part Number'] || r['part'] || '').trim(),
              desc: String(r['Description'] || r['desc'] || '').trim(),
              customer: String(r['Customer'] || r['customer'] || '').trim(),
              minifactory: String(r['Minifactory'] || r['minifactory'] || '').trim(),
              line: String(r['Line'] || r['line'] || '').trim(),
              stakeholder: String(r['Stakeholder'] || r['stakeholder'] || '').trim(),
              category: String(r['Issue Category'] || r['category'] || 'Other').trim(),
              discussion: String(r['Stakeholder Input / Discussion'] || r['discussion'] || '').trim(),
              action: String(r['Action Being Taken'] || r['action'] || '').trim(),
              owner: String(r['Owner'] || r['owner'] || '').trim(),
              target_date: String(r['Target Date'] || r['target_date'] || '').trim(),
              status: String(r['Status'] || r['status'] || 'Open').trim(),
              criticality: String(r['Control Status'] || r['criticality'] || 'Critical').trim(),
              needs_escalation: String(r['Needs Escalation'] || r['needs_escalation'] || 'No').trim(),
              escalation_details: String(r['Escalation Details'] || r['escalation_details'] || '').trim(),
              plan_val: Number(r['Plan Value (INR) at entry'] || r['plan_val'] || 0),
              pending_val: Number(r['Pending Value (INR) at entry'] || r['pending_val'] || 0)
            }));

            const updatedData = { ...currentData, comments: importedComments };
            onImportData(updatedData);
            setImportStatus({ msg: `Successfully imported ${importedComments.length} comments from ${file.name}` });
          } else {
            setImportStatus({
              msg: `Excel workbook loaded (${sheetNames.join(', ')}). To import comments, ensure sheet name is 'Comments'.`,
              isError: false
            });
          }
        } catch (err: any) {
          setImportStatus({ msg: 'Failed to process Excel workbook: ' + err.message, isError: true });
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleExportBackup = () => {
    const jsonStr = JSON.stringify(currentData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KSPG_Command_Center_Backup_${currentData.meta.cutoff_date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs select-none">
      <div className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-lg shadow-2xl max-w-xl w-full p-4 flex flex-col gap-3">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-2.5">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-400" />
            <span className="font-extrabold text-[14px] text-[var(--text-main)]">
              Data &amp; Excel Management
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-[var(--bg-card)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status message */}
        {importStatus && (
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded text-xs font-semibold ${
              importStatus.isError
                ? 'bg-rose-500/15 border border-rose-500/40 text-rose-400'
                : 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-400'
            }`}
          >
            {importStatus.isError ? (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{importStatus.msg}</span>
          </div>
        )}

        {/* Overview of current loaded data */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-3 text-xs space-y-1.5">
          <div className="font-bold text-slate-200 uppercase text-[10.5px] tracking-wide">
            Active Dataset Overview
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
            <div>
              ● Demand FG Parts: <strong className="text-white">{currentData.demand.length}</strong>
            </div>
            <div>
              ● Monitored RMPM Parts: <strong className="text-white">{currentData.rmpm_parts.length}</strong>
            </div>
            <div>
              ● MB51 Ledger Rows: <strong className="text-white">{currentData.mb51.length}</strong>
            </div>
            <div>
              ● MB52 Stock Items: <strong className="text-white">{currentData.mb52.length}</strong>
            </div>
            <div>
              ● Working Days: <strong className="text-white">{currentData.meta.total_working_days}</strong> ({currentData.meta.elapsed_working_days} elapsed)
            </div>
            <div>
              ● Comments Logged: <strong className="text-emerald-400">{currentData.comments.length}</strong>
            </div>
          </div>
        </div>

        {/* Expected Excel Input Files Info */}
        <div className="border border-[var(--border)] rounded p-3 text-xs bg-[var(--bg-card)]/50 space-y-1.5">
          <div className="font-bold text-blue-400 text-[10.5px] uppercase">
            Compatible Standard Files
          </div>
          <p className="text-slate-400 text-[11px]">
            In production, the engine reads the 8 standard files:
            <span className="text-slate-300 font-mono text-[10px] block mt-1">
              Calendar.xlsx, Demand.xlsx, Exchange Rate.xlsx, Master.xlsx, Mb51.xlsx, MB52.xlsx, Price.xlsx, Vendor.xlsx, Critical_FG_Comments_Log.xlsx
            </span>
          </p>
        </div>

        {/* File upload input */}
        <div className="border-2 border-dashed border-[var(--border)] hover:border-blue-500 rounded-lg p-5 flex flex-col items-center justify-center text-center gap-2 cursor-pointer transition-colors bg-[var(--bg-card)]/40"
             onClick={() => fileInputRef.current?.click()}>
          <Upload className="w-8 h-8 text-blue-400" />
          <div className="text-xs font-bold text-slate-200">
            Click to upload Excel (.xlsx) or JSON Backup
          </div>
          <div className="text-[10.5px] text-slate-400">
            Supports Critical_FG_Comments_Log.xlsx or full Command Center JSON exports
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.json"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between border-t border-[var(--border)] pt-3 gap-2 flex-wrap">
          <button
            onClick={() => {
              if (confirm('Reset entire application to built-in Kolbenschmidt Pierburg (KSPG) sample dataset?')) {
                onResetToDemo();
                setImportStatus({ msg: 'Restored original comprehensive demo dataset.' });
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-amber-500/40 text-amber-400 bg-[var(--bg-card)] hover:bg-amber-500/15 text-xs font-bold cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo Data</span>
          </button>

          <button
            onClick={handleExportBackup}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer ml-auto"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Full Backup JSON</span>
          </button>
        </div>
      </div>
    </div>
  );
};
