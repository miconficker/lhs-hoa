import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api, DocumentsResponse } from "@/lib/api";
import { format } from "date-fns";
import {
  DocumentArrowDownIcon,
  DocumentIcon,
  CloudArrowUpIcon,
  TrashIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import type { DocumentCategory } from "@/types";

const categoryColors: Record<DocumentCategory, string> = {
  rules: "bg-blue-100 text-blue-700",
  forms: "bg-green-100 text-green-700",
  minutes: "bg-yellow-100 text-yellow-700",
  policies: "bg-purple-100 text-purple-700",
};

const categoryLabels: Record<DocumentCategory, string> = {
  rules: "Rules & Regulations",
  forms: "Forms",
  minutes: "Meeting Minutes",
  policies: "Policies",
};

const categoryIcons: Record<DocumentCategory, string> = {
  rules: "📜",
  forms: "📝",
  minutes: "📋",
  policies: "📖",
};

export function DocumentsPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    DocumentCategory | "all"
  >("all");
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const isAdmin = user?.role === "admin" || user?.role === "staff";

  useEffect(() => {
    loadDocuments();
  }, [selectedCategory]);

  async function loadDocuments() {
    setLoading(true);
    setError("");

    const result = await api.documents.list(
      selectedCategory === "all" ? undefined : selectedCategory,
    );

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setDocuments(result.data);
    }

    setLoading(false);
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploading(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const file = formData.get("file") as File;
    const title = formData.get("title") as string;
    const category = formData.get("category") as DocumentCategory | "";

    if (!file) {
      setError("Please select a file");
      setUploading(false);
      return;
    }

    if (!title) {
      setError("Please enter a title");
      setUploading(false);
      return;
    }

    const result = await api.documents.create({
      title,
      category: category || undefined,
      file,
    });

    if (result.error) {
      setError(result.error);
    } else {
      setShowUploadForm(false);
      loadDocuments();
      // Reset form
      event.currentTarget.reset();
    }

    setUploading(false);
  }

  async function handleDownload(documentId: string) {
    const url = api.documents.getDownloadUrl(documentId);
    window.open(url, "_blank");
  }

  async function handleDelete(documentId: string) {
    if (!confirm("Are you sure you want to delete this document?")) {
      return;
    }

    const result = await api.documents.delete(documentId);

    if (result.error) {
      setError(result.error);
    } else {
      loadDocuments();
    }
  }

  function handlePreview(documentId: string, documentTitle: string) {
    setPreviewDocument({ id: documentId, title: documentTitle });
  }

  function canPreview(fileName: string): boolean {
    const ext = fileName.split(".").pop()?.toLowerCase();
    return ext === "pdf";
  }

  if (loading && !documents) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-600 mt-1">
            View and download HOA documents, forms, and policies
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowUploadForm(!showUploadForm)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <CloudArrowUpIcon className="w-5 h-5" />
            Upload Document
          </button>
        )}
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory("all")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            selectedCategory === "all"
              ? "bg-primary-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          All Documents
        </button>
        {(["rules", "forms", "minutes", "policies"] as DocumentCategory[]).map(
          (cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedCategory === cat
                  ? "bg-primary-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span className="mr-1">{categoryIcons[cat]}</span>
              {categoryLabels[cat]}
            </button>
          ),
        )}
      </div>

      {/* Upload Form */}
      {showUploadForm && isAdmin && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Upload Document</h2>
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <input
                type="text"
                name="title"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                placeholder="Document title"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                name="category"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">No Category</option>
                <option value="rules">Rules & Regulations</option>
                <option value="forms">Forms</option>
                <option value="minutes">Meeting Minutes</option>
                <option value="policies">Policies</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                File
              </label>
              <input
                type="file"
                name="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Accepted formats: PDF, DOC, DOCX, XLS, XLSX, TXT
              </p>
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg">
                {error}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowUploadForm(false)}
                disabled={uploading}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploading}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <CloudArrowUpIcon className="w-5 h-5" />
                    Upload
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Error Display */}
      {error && !showUploadForm && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Documents Grid */}
      {documents?.documents && documents.documents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.documents.map((document) => (
            <div
              key={document.id}
              className="bg-white rounded-lg shadow hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      {document.category && (
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${categoryColors[document.category]}`}
                        >
                          {categoryLabels[document.category]}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                      {document.title}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Uploaded{" "}
                      {format(new Date(document.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                  <DocumentIcon className="w-12 h-12 text-gray-400 flex-shrink-0 ml-4" />
                </div>

                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => handleDownload(document.id)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
                  >
                    <DocumentArrowDownIcon className="w-4 h-4" />
                    Download
                  </button>
                  {canPreview(document.title) && (
                    <button
                      onClick={() => handlePreview(document.id, document.title)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
                    >
                      <EyeIcon className="w-4 h-4" />
                      Preview
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(document.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title="Delete document"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <DocumentIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No documents found.</p>
          {selectedCategory !== "all" && (
            <button
              onClick={() => setSelectedCategory("all")}
              className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
            >
              View all documents
            </button>
          )}
        </div>
      )}

      {/* Preview Modal */}
      {previewDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">
                {previewDocument.title}
              </h3>
              <button
                onClick={() => setPreviewDocument(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <iframe
                src={api.documents.getDownloadUrl(previewDocument.id)}
                className="w-full h-full min-h-[500px] border-0"
                title={previewDocument.title}
              />
            </div>
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => setPreviewDocument(null)}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
