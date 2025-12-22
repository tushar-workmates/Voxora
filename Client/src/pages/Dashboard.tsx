import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Upload, 
  FileText, 
  Trash2, 
  Download,
  Plus,
  FileType,
  Calendar,
  HardDrive,
  Eye
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getFiles, deleteFile, uploadPdf } from "@/services/api";

export default function Dashboard() {
  const [files, setFiles] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [viewingFile, setViewingFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load files on component mount
  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      const result = await getFiles();
      if (result.success && result.data?.files) {
        setFiles(result.data.files);
      } else if (result.files) {
        setFiles(result.files);
      } else {
        setFiles([]);
      }
    } catch (error) {
      console.error('Failed to load files:', error);
      setFiles([]);
      // Don't show error toast for network errors
      if (error?.response?.status && error.response.status !== 503) {
        toast.error('Failed to load files');
      }
    }
  };

  const handleFileUpload = async (uploadedFiles: FileList | null) => {
    if (!uploadedFiles) return;
    
    setIsLoading(true);
    
    try {
      for (const file of Array.from(uploadedFiles)) {
        const result = await uploadPdf(file);
        if (result.success) {
          toast.success(`${file.name} uploaded successfully`);
        } else {
          toast.error(`Failed to upload ${file.name}: ${result.message || 'Unknown error'}`);
        }
      }
      // Reload files after upload
      await loadFiles();
    } catch (error: any) {
      console.error('Upload error:', error);
      const errorMessage = error?.response?.data?.detail || error.message || "Upload failed - server offline";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteFile = async (filename: string) => {
    try {
      await deleteFile(filename);
      setFiles(prev => prev.filter(f => f.name !== filename));
      toast.success(`${filename} deleted successfully`);
    } catch (error) {
      console.error('Failed to delete file:', error);
      toast.error(`Failed to delete ${filename}`);
    }
  };

  const handleViewFile = (filename: string) => {
    setViewingFile(filename);
  };

  const getUserId = () => {
    const token = localStorage.getItem('token');
    if (!token || token === 'fake-jwt-token') return 'default';
    
    try {
      // Decode JWT token to get user_id
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.user_id || payload._id || payload.id || payload.uid || 'default';
    } catch (error) {
      console.error('Failed to decode token:', error);
      return 'default';
    }
  };



  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  };

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-3xl font-bold mb-2">Knowledge Base</h1>
          <p className="text-muted-foreground">
            Upload and manage your AI assistant's knowledge base with PDF and DOC files
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-up">
          <Card className="glass-card card-emerald hover:shadow-colorful transition-all duration-300 transform hover:scale-105">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-700">Total Files</CardTitle>
              <FileText className="h-5 w-5 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-800">{files.length}</div>
              <p className="text-xs text-emerald-600">
                Knowledge base documents
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card card-violet hover:shadow-colorful transition-all duration-300 transform hover:scale-105">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-violet-700">Storage Used</CardTitle>
              <HardDrive className="h-5 w-5 text-violet-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-violet-800">5.1 MB</div>
              <p className="text-xs text-violet-600">
                of 100 MB available
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card card-rose hover:shadow-colorful transition-all duration-300 transform hover:scale-105">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-rose-700">Last Updated</CardTitle>
              <Calendar className="h-5 w-5 text-rose-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-rose-800">Today</div>
              <p className="text-xs text-rose-600">
                Knowledge base sync
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Upload Area */}
        <Card className="glass-card animate-scale-in">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Upload className="w-5 h-5" />
              <span>Upload Knowledge Base Files</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-300 ${
                isDragOver 
                  ? "border-primary bg-primary/5 scale-105" 
                  : "border-border hover:border-primary/50 hover:bg-primary/5"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">
                Drop your PDF files here
              </h3>
              <p className="text-muted-foreground mb-4">
                or click to browse your PDF files
              </p>
              <Button
                className="gradient-primary text-primary-foreground shadow-glow"
                onClick={() => document.getElementById('file-upload')?.click()}
                disabled={isLoading}
              >
                <Plus className="w-4 h-4 mr-2" />
                {isLoading ? 'Uploading...' : 'Choose Files'}
              </Button>
              <input
                id="file-upload"
                type="file"
                multiple
                accept="*"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Files Table */}
        <Card className="glass-card animate-slide-up delay-200">
          <CardHeader>
            <CardTitle>Uploaded Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 font-medium">Name</th>
                    <th className="text-left p-4 font-medium">Type</th>
                    <th className="text-left p-4 font-medium">Size</th>
                    <th className="text-left p-4 font-medium">Upload Date</th>
                    <th className="text-left p-4 font-medium">Actions</th>
                    <th className="text-left p-4 font-medium">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {files.length > 0 ? files.map((file) => (
                    <tr key={file.id || file.name} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center space-x-3">
                          <FileType className="w-4 h-4 text-primary" />
                          <span className="font-medium">{file.name}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                          {file.type || 'PDF'}
                        </span>
                      </td>
                      <td className="p-4 text-muted-foreground">{file.size || 'Unknown'}</td>
                      <td className="p-4 text-muted-foreground">{file.uploadDate || 'Recently'}</td>
                      <td className="p-4">
                        <div className="flex space-x-2">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="hover:bg-blue-500/10 hover:text-blue-500"
                            onClick={() => handleViewFile(file.name)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                      <td className="p-4">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleDeleteFile(file.name)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        No files uploaded yet. Upload your first PDF to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PDF Viewer Dialog */}
      <Dialog open={!!viewingFile} onOpenChange={() => setViewingFile(null)}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>{viewingFile}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 w-full h-full">
            {viewingFile && (
              <embed
                src={`http://localhost:8000/uploads/${getUserId()}/${viewingFile}#toolbar=0`}
                type="application/pdf"
                className="w-full h-full"
                title={viewingFile}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}