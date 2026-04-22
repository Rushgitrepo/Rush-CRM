import React, { useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, ArrowRight, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface FieldMapping {
  [csvField: string]: string | null;
}

interface DetectedFields {
  fileName: string;
  filePath: string;
  headers: string[];
  sampleData: any[];
  suggestedMappings: FieldMapping;
  totalRows: number;
}

export default function ContactImportPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'upload' | 'mapping' | 'importing' | 'complete'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [detectedFields, setDetectedFields] = useState<DetectedFields | null>(null);
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({});
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [importResult, setImportResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const availableFields = [
    { value: 'first_name',    label: 'First Name' },
    { value: 'last_name',     label: 'Last Name' },
    { value: 'email',         label: 'Email Address' },
    { value: 'phone',         label: 'Phone Number' },
    { value: 'position',      label: 'Job Title / Position' },
    { value: 'company_name',  label: 'Company Name' },
    { value: 'contact_type',  label: 'Contact Type' },
    { value: 'source',        label: 'Source / Channel' },
    { value: 'notes',         label: 'Notes / Description' },
    { value: 'linkedin_url',  label: 'LinkedIn URL' },
    { value: 'website',       label: 'Website / URL' },
  ];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const data = await api.post<DetectedFields>('/contact-import/detect-fields', formData);
      setDetectedFields(data);
      setFieldMapping(data.suggestedMappings || {});
      setStep('mapping');
    } catch (error: any) {
      toast.error(`Error: ${error?.message || 'Failed to process file'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!detectedFields) return;

    setLoading(true);
    setStep('importing');

    try {
      const data = await api.post<any>('/contact-import', {
        filePath: detectedFields.filePath,
        fieldMapping,
        skipDuplicates,
      });

      setImportResult(data);
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setStep('complete');
    } catch (error: any) {
      toast.error('Failed to import contacts');
      setStep('mapping');
    } finally {
      setLoading(false);
    }
  };

  const stepClass = (active: boolean, done: boolean) =>
    `flex items-center ${done ? 'text-green-600' : active ? 'text-primary' : 'text-gray-400'}`;
  const circleClass = (active: boolean, done: boolean) =>
    `w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${done ? 'bg-green-600 text-white' : active ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Import Contacts</h1>
            <p className="text-gray-500 text-sm">Upload a CSV or Excel file to bulk-import contacts into your CRM</p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="mb-8 flex items-center justify-center gap-4">
        <div className={stepClass(step === 'upload', ['mapping','importing','complete'].includes(step))}>
          <div className={circleClass(step === 'upload', ['mapping','importing','complete'].includes(step))}>1</div>
          <span className="ml-2 font-medium">Upload File</span>
        </div>
        <ArrowRight className="h-4 w-4 text-gray-300" />
        <div className={stepClass(step === 'mapping' || step === 'importing', step === 'complete')}>
          <div className={circleClass(step === 'mapping' || step === 'importing', step === 'complete')}>2</div>
          <span className="ml-2 font-medium">Map Fields</span>
        </div>
        <ArrowRight className="h-4 w-4 text-gray-300" />
        <div className={stepClass(step === 'complete', false)}>
          <div className={circleClass(step === 'complete', false)}>3</div>
          <span className="ml-2 font-medium">Complete</span>
        </div>
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="rounded-2xl shadow-sm border p-10">
          <div className="border-2 border-dashed rounded-xl p-12 text-center hover:border-primary/50 transition-colors">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-primary/80 mb-1">Upload your contacts file</h3>
            <p className="text-gray-500 text-sm mb-6">Supports CSV, XLSX, and XLS files up to 10 MB</p>
            <label className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg cursor-pointer hover:bg-primary/90 transition-all shadow-md active:scale-95 font-medium">
              <FileSpreadsheet className="h-4 w-4" />
              Choose File
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                disabled={loading}
              />
            </label>
            {file && <p className="mt-3 text-sm text-gray-500">Selected: <strong>{file.name}</strong></p>}
            {loading && <p className="mt-3 text-sm text-primary animate-pulse">Analysing file…</p>}
          </div>
        </div>
      )}

      {/* Step 2: Field Mapping */}
      {(step === 'mapping' || step === 'importing') && detectedFields && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Map Your Fields</h2>
          <p className="text-gray-500 text-sm mb-6">
            Match your file columns to contact fields. We've pre-filled suggested mappings.
          </p>

          <div className="space-y-3 mb-6 max-h-[420px] overflow-y-auto pr-1">
            {detectedFields.headers.map((header) => (
              <div key={header} className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{header}</p>
                  {detectedFields.sampleData[0]?.[header] && (
                    <p className="text-xs text-gray-400 truncate">
                      e.g. {String(detectedFields.sampleData[0][header]).substring(0, 60)}
                    </p>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                <div className="flex-1">
                  <select
                    value={fieldMapping[header] || ''}
                    onChange={(e) => setFieldMapping({ ...fieldMapping, [header]: e.target.value || null })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all bg-white"
                  >
                    <option value="">— Skip this column —</option>
                    {availableFields.map((field) => (
                      <option key={field.value} value={field.value}>{field.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          <label className="flex items-center gap-2 mb-6 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={skipDuplicates}
              onChange={(e) => setSkipDuplicates(e.target.checked)}
              className="rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-sm text-gray-700">Skip duplicate contacts (matched by email)</span>
          </label>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('upload')}
              className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleImport}
              disabled={loading || step === 'importing'}
              className="flex-1 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all shadow-md active:scale-[0.98]"
            >
              {step === 'importing' ? 'Importing contacts…' : 'Import Contacts'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Complete */}
      {step === 'complete' && importResult && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Import Complete!</h2>
            <p className="text-gray-500 text-sm">Your contacts have been added to the CRM</p>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="p-5 bg-green-50 rounded-xl border border-green-100 text-center">
              <div className="text-3xl font-bold text-green-600">{importResult.successful}</div>
              <div className="text-sm text-gray-600 mt-1">Imported</div>
            </div>
            <div className="p-5 bg-amber-50 rounded-xl border border-amber-100 text-center">
              <div className="text-3xl font-bold text-amber-600">{importResult.duplicates}</div>
              <div className="text-sm text-gray-600 mt-1">Duplicates Skipped</div>
            </div>
            <div className="p-5 bg-red-50 rounded-xl border border-red-100 text-center">
              <div className="text-3xl font-bold text-red-600">{importResult.failed}</div>
              <div className="text-sm text-gray-600 mt-1">Failed</div>
            </div>
          </div>

          {importResult.errors?.length > 0 && (
            <div className="mb-8 p-4 bg-red-50 rounded-xl border border-red-100">
              <h3 className="font-semibold text-red-700 mb-2 text-sm">Import Errors</h3>
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {importResult.errors.map((err: any, idx: number) => (
                  <p key={idx} className="text-xs text-red-600">Row {err.row}: {err.error}</p>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => { setStep('upload'); setFile(null); setDetectedFields(null); setImportResult(null); }}
              className="flex-1 px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Import More
            </button>
            <button
              onClick={() => navigate('/crm/customers/contacts')}
              className="flex-1 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-all shadow-md active:scale-[0.98]"
            >
              View Contacts
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
