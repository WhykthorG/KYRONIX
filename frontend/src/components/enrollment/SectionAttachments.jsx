import React, { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Upload, X, FileText } from 'lucide-react';
import {
  OPTIMIZABLE_IMAGE_MIME_TYPES,
  MAX_IMAGE_UPLOAD_SOURCE_BYTES,
} from '@/lib/imageUploadOptimizer';
import {
  DEFAULT_STORAGE_BUCKET,
  createStorageFileReference,
  deleteStorageFile,
  getStoredFileName,
  getStorageFileKey,
  uploadStorageFile,
} from '@/lib/storageFiles';

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const BUCKET = DEFAULT_STORAGE_BUCKET;

export default function SectionAttachments({ attachments, onChange, errors }) {
  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [removingFileKey, setRemovingFileKey] = useState(null);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    setUploadError('');
    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) { 
        setUploadError(`Tipo não permitido: ${file.name}`); 
        continue; 
      }
      if (OPTIMIZABLE_IMAGE_MIME_TYPES.includes(file.type) && file.size > MAX_IMAGE_UPLOAD_SOURCE_BYTES) {
        setUploadError(`Imagem muito grande: ${file.name}. Máx ${Math.round(MAX_IMAGE_UPLOAD_SOURCE_BYTES / (1024 * 1024))}MB antes da otimização.`);
        continue;
      }
      if (!OPTIMIZABLE_IMAGE_MIME_TYPES.includes(file.type) && file.size > MAX_SIZE) { 
        setUploadError(`Arquivo muito grande: ${file.name}. Máx 5MB`); 
        continue; 
      }
      setUploading(true);
      try {
        const path = await uploadStorageFile({ file, folder: 'attachments', bucket: BUCKET });
        onChange([
          ...attachments,
          createStorageFileReference({
            filePath: path,
            fileName: file.name,
            bucket: BUCKET,
            description: '',
          }),
        ]);
      } catch (err) { 
        setUploadError(`Erro ao enviar ${file.name}: ${err.message}`); 
      } finally { 
        setUploading(false); 
      }
    }
    e.target.value = '';
  };

  const updateDescription = (index, desc) => onChange(attachments.map((a, i) => i === index ? { ...a, description: desc } : a));

  const remove = async (index) => {
    const attachment = attachments[index];
    const fileKey = getStorageFileKey(attachment, BUCKET) || String(index);
    setUploadError('');
    setRemovingFileKey(fileKey);

    try {
      await deleteStorageFile(attachment, { bucket: BUCKET });
      onChange(attachments.filter((_, i) => i !== index));
    } catch (error) {
      setUploadError(`Erro ao remover ${getStoredFileName(attachment, BUCKET)}: ${error.message}`);
    } finally {
      setRemovingFileKey(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all" onClick={() => fileRef.current?.click()}>
        <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm font-medium text-slate-700">Clique para anexar documentos</p>
        <p className="text-xs text-slate-400 mt-1">PDF até 5MB. JPG e PNG são otimizados automaticamente antes do envio.</p>
        <input ref={fileRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleFileSelect} />
      </div>
      {uploading && <p className="text-sm text-indigo-600 animate-pulse">Enviando arquivo…</p>}
      {uploadError && <p className="text-sm text-red-500">{uploadError}</p>}
      {attachments.length > 0 && (
        <div className="space-y-3">
          {attachments.map((att, i) => (
            <div key={getStorageFileKey(att, BUCKET) || i} className="flex gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-sm font-medium text-slate-700 truncate">{getStoredFileName(att, BUCKET)}</p>
                <Input 
                  placeholder="Descrição do documento *" 
                  value={att.description || ''} 
                  onChange={(e) => updateDescription(i, e.target.value)} 
                  className={`text-sm ${errors?.[`attachment_${i}`] ? 'border-red-400' : ''}`} 
                />
                {errors?.[`attachment_${i}`] && <p className="text-xs text-red-500 mt-1">{errors[`attachment_${i}`]}</p>}
              </div>
              <button
                type="button"
                onClick={() => void remove(i)}
                disabled={removingFileKey === (getStorageFileKey(att, BUCKET) || String(i))}
                className="text-slate-400 hover:text-red-500 flex-shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`Remover anexo ${i + 1}`}
                data-tooltip={`Remover anexo ${i + 1}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

