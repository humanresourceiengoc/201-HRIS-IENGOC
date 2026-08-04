import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Download, ZoomIn, ZoomOut, FileText, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { triggerFileDownload, getFileUrl } from '../lib/db';

interface FileViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileTitle: string;
  filename: string;
  fileIdOrUrl?: string;
  mimeType?: string;
  notes?: string;
  uploadedAt?: string;
}

export const FileViewerModal: React.FC<FileViewerModalProps> = ({
  isOpen,
  onClose,
  fileTitle,
  filename,
  fileIdOrUrl,
  mimeType,
  notes,
  uploadedAt
}) => {
  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [zoom, setZoom] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !fileIdOrUrl) {
      setResolvedUrl('');
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(false);
    setZoom(1);

    getFileUrl(fileIdOrUrl)
      .then(url => {
        if (isMounted) {
          setResolvedUrl(url);
          setLoading(false);
        }
      })
      .catch(err => {
        console.error('Error resolving file URL:', err);
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, fileIdOrUrl]);

  if (!isOpen) return null;

  const isPdf = Boolean(
    (mimeType && mimeType.includes('pdf')) ||
    (filename && filename.toLowerCase().endsWith('.pdf')) ||
    (resolvedUrl && (resolvedUrl.includes('.pdf') || resolvedUrl.startsWith('data:application/pdf')))
  );

  const isImage = Boolean(
    (mimeType && mimeType.includes('image')) ||
    (filename && /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(filename)) ||
    (resolvedUrl && (resolvedUrl.startsWith('data:image/') || /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(resolvedUrl)))
  );

  const handleOpenInNewTab = () => {
    if (resolvedUrl) {
      window.open(resolvedUrl, '_blank');
    }
  };

  const handleDownload = () => {
    if (fileIdOrUrl) {
      triggerFileDownload(fileIdOrUrl, filename || 'download');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-800 rounded-lg text-blue-400">
              {isPdf ? <FileText className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-base line-clamp-1">{fileTitle || filename || 'Document Viewer'}</h3>
              <p className="text-xs text-slate-400">{filename} {uploadedAt ? `• Uploaded ${new Date(uploadedAt).toLocaleDateString()}` : ''}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isImage && (
              <div className="flex items-center bg-slate-800 rounded-lg p-1 mr-2">
                <button
                  onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                  className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono px-2 text-slate-300">{Math.round(zoom * 100)}%</span>
                <button
                  onClick={() => setZoom(z => Math.min(3, z + 0.25))}
                  className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              onClick={handleOpenInNewTab}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Open in Tab</span>
            </button>

            <button
              onClick={handleDownload}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Download file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 bg-slate-100 overflow-auto relative p-4 flex items-center justify-center">
          {loading && (
            <div className="text-center p-8">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-sm font-semibold text-slate-600">Loading document preview...</p>
            </div>
          )}

          {error && (
            <div className="text-center p-8 max-w-md bg-white rounded-xl shadow-sm border border-red-200">
              <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
              <h4 className="font-bold text-slate-800 text-base mb-1">Unable to Preview File</h4>
              <p className="text-xs text-slate-500 mb-4">The file could not be loaded directly into the viewer. You can still download it or open it in a new tab.</p>
              <div className="flex justify-center gap-3">
                <button onClick={handleOpenInNewTab} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold">Open in Tab</button>
                <button onClick={handleDownload} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold">Download File</button>
              </div>
            </div>
          )}

          {!loading && !error && resolvedUrl && (
            <>
              {isImage ? (
                <div className="w-full h-full flex items-center justify-center overflow-auto p-2">
                  <img
                    src={resolvedUrl}
                    alt={filename}
                    style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-md transition-transform duration-150"
                  />
                </div>
              ) : isPdf ? (
                <iframe
                  src={resolvedUrl}
                  title={filename}
                  className="w-full h-full rounded-lg border border-slate-300 shadow-inner bg-white"
                />
              ) : (
                <div className="text-center p-8 bg-white rounded-xl shadow-sm max-w-md">
                  <FileText className="w-16 h-16 text-slate-400 mx-auto mb-3" />
                  <h4 className="font-bold text-slate-800 text-base mb-1">{filename}</h4>
                  <p className="text-xs text-slate-500 mb-4">This document type cannot be embedded inline. Click below to view or download.</p>
                  <div className="flex justify-center gap-3">
                    <button onClick={handleOpenInNewTab} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-2">
                      <ExternalLink className="w-4 h-4" /> Open File
                    </button>
                    <button onClick={handleDownload} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center gap-2">
                      <Download className="w-4 h-4" /> Download
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Notes */}
        {notes && (
          <div className="px-6 py-3 bg-amber-50 border-t border-amber-200 text-amber-900 text-xs shrink-0 flex items-start gap-2">
            <span className="font-bold uppercase tracking-wider text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded">Notes:</span>
            <span>{notes}</span>
          </div>
        )}
      </div>
    </div>
  );
};
