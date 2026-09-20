"use client";

import {
  DOCUMENT_ACCESS_LEVELS,
  DOCUMENT_CATEGORIES,
  DOCUMENT_TYPES,
  humanizeConstant,
} from "../record-constants";
import type { DocumentAccessLevel } from "../records-types";
import { Field, fieldClass, errorFieldClass } from "./RecordsUi";
import { useDropzone } from "react-dropzone";
import { UploadCloud, File as FileIcon, X, Camera } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export function DocumentMetadataFields({
  role,
  includeFile,
  defaults,
  errors,
  file,
  onFileChange,
}: {
  role: "chairman" | "bookkeeper";
  includeFile?: boolean;
  defaults?: {
    title?: string;
    description?: string | null;
    category?: string;
    documentType?: string;
    accessLevel?: DocumentAccessLevel;
  };
  errors?: Record<string, string>;
  file?: File | null;
  onFileChange?: (file: File | null) => void;
}) {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      streamRef.current = stream;
      setIsCameraOpen(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Could not access camera. Please check permissions.");
    }
  };

  useEffect(() => {
    if (isCameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isCameraOpen]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `scan-${Date.now()}.jpg`, {
            type: "image/jpeg",
          });
          onFileChange?.(file);
          stopCamera();
        }
      }, "image/jpeg", 0.9);
    }
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (onFileChange && acceptedFiles[0]) {
        onFileChange(acceptedFiles[0]);
      }
    },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
    accept: {
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "text/csv": [".csv"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
    },
  });
  const categories =
    role === "bookkeeper"
      ? DOCUMENT_CATEGORIES.filter((item) =>
          [
            "FINANCIAL",
            "RECEIPT",
            "RENTAL",
            "POS_AND_SALES",
            "INVENTORY",
            "AUDIT",
            "OTHER",
          ].includes(item),
        )
      : DOCUMENT_CATEGORIES;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Document title" required wide error={errors?.title}>
        <input
          name="title"
          required
          maxLength={255}
          defaultValue={defaults?.title ?? ""}
          className={errors?.title ? errorFieldClass : fieldClass}
        />
      </Field>
      <Field label="Description" wide error={errors?.description}>
        <textarea
          name="description"
          rows={3}
          maxLength={5000}
          defaultValue={defaults?.description ?? ""}
          className={errors?.description ? `${errorFieldClass} py-3` : `${fieldClass} py-3`}
        />
      </Field>
      <Field label="Category" required error={errors?.category}>
        <select
          name="category"
          required
          defaultValue={defaults?.category ?? ""}
          className={errors?.category ? errorFieldClass : fieldClass}
        >
          <option value="">Select category</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {humanizeConstant(item)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Document type" required error={errors?.documentType}>
        <select
          name="documentType"
          required
          defaultValue={defaults?.documentType ?? ""}
          className={errors?.documentType ? errorFieldClass : fieldClass}
        >
          <option value="">Select type</option>
          {DOCUMENT_TYPES.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </Field>
      <Field label="Access level" required wide={!includeFile} error={errors?.accessLevel}>
        <select
          name="accessLevel"
          required
          defaultValue={defaults?.accessLevel ?? ""}
          className={errors?.accessLevel ? errorFieldClass : fieldClass}
        >
          <option value="">Select access</option>
          {DOCUMENT_ACCESS_LEVELS.filter(
            (item) => role === "chairman" || item.value !== "ADMIN_ONLY",
          ).map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </Field>
      {includeFile ? (
        <div className="sm:col-span-2">
          <Field
            label="File"
            required
            wide
            error={errors?.file}
            hint="PDF, DOC, DOCX, XLS, XLSX, CSV, JPG, JPEG, or PNG; maximum 10 MB."
          >
            {file ? (
              <div className="flex items-center gap-4 p-4 border rounded-lg border-[#1F6B43] bg-[#E7F2E4]">
                <FileIcon className="size-8 text-[#1F6B43]" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#123D2A] truncate">{file.name}</p>
                  <p className="text-xs text-[#5D6D63]">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button
                  type="button"
                  onClick={() => onFileChange?.(null)}
                  className="p-2 hover:bg-black/5 rounded"
                >
                  <X className="size-5 text-[#5D6D63]" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3 items-stretch">
                <div
                  {...getRootProps()}
                  className={`flex-1 cursor-pointer transition-colors border-2 border-dashed p-3 rounded-lg flex flex-col items-center justify-center gap-1 text-center ${
                    isDragActive
                      ? "border-[#1F6B43] bg-[#E7F2E4]"
                      : errors?.file
                        ? "border-red-500 bg-red-50"
                        : "border-[#CAD8CB] bg-white hover:bg-[#F8FAF8]"
                  }`}
                >
                  <input {...getInputProps()} name="file-dropzone" />
                  <UploadCloud className={`size-6 ${isDragActive ? "text-[#1F6B43]" : "text-[#6C7A70]"}`} />
                  <div>
                    <p className="text-sm font-medium text-[#294B39]">
                      {isDragActive ? "Drop the file here" : "Drag and drop, or click"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={startCamera}
                  className="inline-flex cursor-pointer flex-col sm:w-28 items-center justify-center gap-1 rounded-lg border border-[#CAD8CB] bg-[#F8FAF8] p-3 text-sm font-bold text-[#294B39] hover:bg-[#EEF2EC]"
                >
                  <Camera className="size-6 text-[#6C7A70]" />
                  <span>Take Photo</span>
                </button>
              </div>
            )}
            
            {isCameraOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
                <div className="w-full max-w-lg rounded-xl bg-white p-4 shadow-2xl">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-[#123D2A]">Take Photo</h3>
                    <button type="button" onClick={stopCamera} className="rounded-md p-1 hover:bg-gray-100">
                      <X className="size-5 text-[#6C7A70]" />
                    </button>
                  </div>
                  <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="rounded-md border border-[#CAD8CB] px-4 py-2 text-sm font-bold text-[#6C7A70] hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="flex items-center gap-2 rounded-md bg-[#1F6B43] px-4 py-2 text-sm font-bold text-white hover:bg-[#123D2A]"
                    >
                      <Camera className="size-4" /> Capture
                    </button>
                  </div>
                </div>
              </div>
            )}
          </Field>
        </div>
      ) : null}
    </div>
  );
}
