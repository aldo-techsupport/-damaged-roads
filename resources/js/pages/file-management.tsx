import { Head, router, useForm } from '@inertiajs/react';
import Heading from '@/components/heading';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { Upload, FileText, Download, Trash2, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';

interface PotholeFile {
    id: number;
    filename: string;
    original_filename: string;
    file_path: string;
    total_records: number;
    is_imported: boolean;
    imported_at: string | null;
    created_at: string;
    uploader: {
        name: string;
        email: string;
    };
}

interface FileManagementProps {
    files: PotholeFile[];
}

export default function FileManagement({ files }: FileManagementProps) {
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleUpload = () => {
        if (!selectedFile) return;

        setUploading(true);

        const formData = new FormData();
        formData.append('file', selectedFile);

        router.post('/files/upload', formData, {
            onSuccess: () => {
                setSelectedFile(null);
                setUploading(false);
                // Reset input file
                const fileInput = document.getElementById('file-input') as HTMLInputElement;
                if (fileInput) fileInput.value = '';
            },
            onError: () => {
                setUploading(false);
            },
        });
    };

    const handleImport = (id: number) => {
        if (confirm('Import file ini ke dashboard? Data lama akan dihapus.')) {
            router.post(`/files/${id}/import`);
        }
    };

    const handleDelete = (id: number) => {
        if (confirm('Hapus file ini? Aksi tidak dapat dibatalkan.')) {
            router.delete(`/files/${id}`);
        }
    };

    const handleDownload = (id: number) => {
        window.location.href = `/files/${id}/download`;
    };

    return (
        <AppSidebarLayout breadcrumbs={[{ label: 'Kelola File' }]}>
            <Head title="Kelola File - Deteksi Lubang Jalan" />

            <div className="space-y-6">
                <Heading title="Kelola File" description="Upload dan kelola file data lubang jalan (TSV/CSV)" />

                {/* Upload Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>Upload File Baru</CardTitle>
                        <CardDescription>
                            Upload file TSV atau CSV dengan format: id, latitude, longitude, gforce, timestamp,
                            maps_link
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="flex-1">
                                    <input
                                        id="file-input"
                                        type="file"
                                        accept=".tsv,.txt,.csv"
                                        onChange={handleFileSelect}
                                        className="block w-full text-sm text-gray-500
                                            file:mr-4 file:py-2 file:px-4
                                            file:rounded-md file:border-0
                                            file:text-sm file:font-semibold
                                            file:bg-primary file:text-primary-foreground
                                            hover:file:bg-primary/90
                                            cursor-pointer"
                                    />
                                </div>
                                <Button onClick={handleUpload} disabled={!selectedFile || uploading}>
                                    <Upload className="w-4 h-4 mr-2" />
                                    {uploading ? 'Uploading...' : 'Upload'}
                                </Button>
                            </div>

                            {selectedFile && (
                                <div className="p-3 bg-muted rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <FileText className="w-4 h-4" />
                                        <span className="text-sm font-medium">{selectedFile.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                            ({(selectedFile.size / 1024).toFixed(2)} KB)
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="text-xs text-muted-foreground">
                                <p>Format file yang didukung: .tsv, .txt, .csv</p>
                                <p>Ukuran maksimal: 10 MB</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Files List */}
                <Card>
                    <CardHeader>
                        <CardTitle>Daftar File</CardTitle>
                        <CardDescription>File yang sudah diupload ({files.length} file)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {files.length === 0 ? (
                            <div className="text-center py-12">
                                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                                <p className="text-muted-foreground">Belum ada file yang diupload</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Upload file TSV/CSV untuk memulai
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {files.map((file) => (
                                    <div
                                        key={file.id}
                                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                                    >
                                        <div className="flex items-center gap-4 flex-1">
                                            <div className="p-2 bg-primary/10 rounded-lg">
                                                <FileText className="w-5 h-5 text-primary" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-medium">{file.original_filename}</h4>
                                                    {file.is_imported && (
                                                        <Badge variant="default" className="gap-1">
                                                            <CheckCircle className="w-3 h-3" />
                                                            Aktif
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                                    <span>{file.total_records} records</span>
                                                    <span>•</span>
                                                    <span>Upload: {new Date(file.created_at).toLocaleDateString('id-ID')}</span>
                                                    {file.is_imported && file.imported_at && (
                                                        <>
                                                            <span>•</span>
                                                            <span>
                                                                Import: {new Date(file.imported_at).toLocaleDateString('id-ID')}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    Oleh: {file.uploader.name}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {!file.is_imported && (
                                                <Button
                                                    size="sm"
                                                    variant="default"
                                                    onClick={() => handleImport(file.id)}
                                                >
                                                    <CheckCircle className="w-4 h-4 mr-1" />
                                                    Import ke Dashboard
                                                </Button>
                                            )}
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleDownload(file.id)}
                                            >
                                                <Download className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => handleDelete(file.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Info Card */}
                <Card>
                    <CardHeader>
                        <CardTitle>Cara Menggunakan</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3 text-sm">
                            <div className="flex gap-3">
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                                    1
                                </div>
                                <div>
                                    <p className="font-medium">Upload File</p>
                                    <p className="text-muted-foreground">
                                        Pilih file TSV/CSV dan klik tombol Upload
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                                    2
                                </div>
                                <div>
                                    <p className="font-medium">Import ke Dashboard</p>
                                    <p className="text-muted-foreground">
                                        Klik tombol "Import ke Dashboard" untuk menampilkan data di peta
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                                    3
                                </div>
                                <div>
                                    <p className="font-medium">Lihat Dashboard</p>
                                    <p className="text-muted-foreground">
                                        Buka menu Dashboard untuk melihat peta dengan data yang sudah diimport
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                            <div className="flex gap-2">
                                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                                <div className="text-sm">
                                    <p className="font-medium text-amber-900 dark:text-amber-100">Perhatian</p>
                                    <p className="text-amber-700 dark:text-amber-300 mt-1">
                                        Import file baru akan menghapus data lama di dashboard. Pastikan Anda sudah
                                        backup data jika diperlukan.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AppSidebarLayout>
    );
}
