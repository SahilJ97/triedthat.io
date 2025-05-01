import React from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogAction,
  AlertDialogDescription
} from '@/components/ui/alert-dialog';
import { CheckCircle, XCircle } from 'lucide-react';

export default function ExtractionResultPopup({ open, onOpenChange, fieldsExtracted }) {
  if (!fieldsExtracted) return null;
  const total = Object.keys(fieldsExtracted).length;
  const completed = Object.values(fieldsExtracted).filter(Boolean).length;
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-h-[80vh] overflow-y-auto bg-white/90 dark:bg-zinc-900/90">
        <AlertDialogHeader>
          <AlertDialogTitle>Extraction Results</AlertDialogTitle>
          <AlertDialogDescription>
            {`According to our extractor, your writeup addresses ${completed} out of ${total} relevant areas. You're more than welcome to edit this log at any time.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 py-2">
          {Object.entries(fieldsExtracted).map(([field, present]) => (
            <div key={field} className="flex items-center gap-2 text-sm">
              <span className="flex items-center justify-center min-w-[1.5em] min-h-[1.5em]">
                {present ? (
                  <CheckCircle className="text-green-600 w-5 h-5" strokeWidth={2} />
                ) : (
                  <XCircle className="text-red-500 w-5 h-5" strokeWidth={2} />
                )}
              </span>
              <span className="whitespace-pre-line">{field}</span>
            </div>
          ))}
        </div>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => onOpenChange(false)} autoFocus>
            OK
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
