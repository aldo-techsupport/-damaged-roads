import { Head, router, useForm } from '@inertiajs/react';
import Heading from '@/components/heading';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, FileText, Upload as UploadIcon, FolderOpen, CheckCircle2, Edit, Trash2, Download } from 'lucide-react';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

interface Pothole {
    id: number;
    latitude: string;
    longitude: string;
    gforce: string;
    recorded_at: string;
    maps_link: string;
}

interface PotholeFile {
    id: number;
    filename: string;
    original_filename: string;
    total_records: number;
    is_imported: boolean;
    imported_at: string | null;
    created_at: string;
    uploader: {
        name: string;
    };
}

interface DashboardProps {
    potholes: Pothole[];
    files: PotholeFile[];
    activeFile: PotholeFile | null;
}

export default function Dashboard({ potholes, files, activeFile }: DashboardProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const [map, setMap] = useState<any>(null);
    const [selectedPothole, setSelectedPothole] = useState<Pothole | null>(null);
    const [leaflet, setLeaflet] = useState<any>(null);
    const [isFileDialogOpen, setIsFileDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingPothole, setEditingPothole] = useState<Pothole | null>(null);
    const [markers, setMarkers] = useState<Map<number, any>>(new Map());
    const [activeMarkerId, setActiveMarkerId] = useState<number | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [severityFilter, setSeverityFilter] = useState<'all' | 'severe' | 'moderate' | 'mild'>('all');
    const [routeLines, setRouteLines] = useState<any[]>([]);
    const [showRoutes, setShowRoutes] = useState(true);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [showStatsDialog, setShowStatsDialog] = useState(false);
    const [lastClickTime, setLastClickTime] = useState<number>(0);
    const [lastClickedFileId, setLastClickedFileId] = useState<number | null>(null);
    const itemsPerPage = 20;

    const { data, setData, put, processing } = useForm({
        latitude: '',
        longitude: '',
        gforce: '',
        recorded_at: '',
    });

    const handleFileSelect = (fileId: number, isAlreadyImported: boolean) => {
        const currentTime = new Date().getTime();
        const timeDiff = currentTime - lastClickTime;
        
        // Double click detection (within 500ms)
        if (isAlreadyImported && lastClickedFileId === fileId && timeDiff < 500) {
            // Double click on active file = unload (no confirmation)
            setIsFileDialogOpen(false);
            router.post('/dashboard/unload-data', {}, {
                onStart: () => {
                    const globalLoading = document.getElementById('global-loading');
                    if (globalLoading) {
                        globalLoading.style.display = 'none';
                    }
                }
            });
            return;
        }
        
        // Update last click info
        setLastClickTime(currentTime);
        setLastClickedFileId(fileId);
        
        // Jika file sudah aktif, jangan lakukan apa-apa (single click)
        if (isAlreadyImported) {
            return;
        }
        
        setIsFileDialogOpen(false);
        setIsLoadingData(true);
        
        router.post(`/dashboard/load-file/${fileId}`, {}, {
            onStart: () => {
                // Disable global loading
                const globalLoading = document.getElementById('global-loading');
                if (globalLoading) {
                    globalLoading.style.display = 'none';
                }
            },
            onFinish: () => {
                // Delay to show animation then show stats dialog
                setTimeout(() => {
                    setIsLoadingData(false);
                    setShowStatsDialog(true);
                }, 500);
            }
        });
    };

    const handleUploadClick = () => {
        setIsFileDialogOpen(false);
        router.visit('/files');
    };

    const handleEdit = (pothole: Pothole) => {
        setEditingPothole(pothole);
        setData({
            latitude: pothole.latitude,
            longitude: pothole.longitude,
            gforce: pothole.gforce,
            recorded_at: pothole.recorded_at.split('T')[0] + ' ' + pothole.recorded_at.split('T')[1].split('.')[0],
        });
        setIsEditDialogOpen(true);
    };

    const handleEditFromSidebar = () => {
        if (selectedPothole) {
            handleEdit(selectedPothole);
        }
    };

    const handleDeleteFromSidebar = () => {
        if (selectedPothole) {
            handleDelete(selectedPothole.id);
        }
    };

    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingPothole) {
            put(`/potholes/${editingPothole.id}`, {
                onSuccess: () => {
                    setIsEditDialogOpen(false);
                    setEditingPothole(null);
                },
            });
        }
    };

    const handleDelete = (id: number) => {
        if (confirm('Hapus data ini? Aksi tidak dapat dibatalkan.')) {
            router.delete(`/potholes/${id}`);
        }
    };

    const handleDownload = () => {
        window.location.href = '/potholes/export';
    };

    // Filter function to check if pothole matches current filter
    const matchesFilter = (pothole: Pothole) => {
        if (severityFilter === 'all') return true;
        
        const gforce = parseFloat(pothole.gforce);
        if (severityFilter === 'severe') return gforce >= 1.15;
        if (severityFilter === 'moderate') return gforce >= 1.05 && gforce < 1.15;
        if (severityFilter === 'mild') return gforce < 1.05;
        return true;
    };

    useEffect(() => {
        // Load Lottie Player script
        const lottieScript = document.createElement('script');
        lottieScript.src = 'https://unpkg.com/@dotlottie/player-component@2.7.12/dist/dotlottie-player.mjs';
        lottieScript.type = 'module';
        document.head.appendChild(lottieScript);

        // Load Leaflet CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);

        // Add custom CSS to fix z-index and add marker animations
        const style = document.createElement('style');
        style.textContent = `
            .leaflet-pane,
            .leaflet-tile,
            .leaflet-marker-icon,
            .leaflet-marker-shadow,
            .leaflet-tile-container,
            .leaflet-pane > svg,
            .leaflet-pane > canvas,
            .leaflet-zoom-box,
            .leaflet-image-layer,
            .leaflet-layer {
                z-index: 1 !important;
            }
            .leaflet-top,
            .leaflet-bottom {
                z-index: 10 !important;
            }
            
            /* Marker active state animation */
            .custom-marker.active > div {
                animation: bounce 0.6s ease-in-out, pulse 1.5s ease-in-out infinite;
                transform: scale(1.4);
                filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.8)) drop-shadow(0 4px 12px rgba(0,0,0,0.5));
                z-index: 1000 !important;
            }
            
            @keyframes bounce {
                0%, 100% {
                    transform: scale(1.4) translateY(0);
                }
                50% {
                    transform: scale(1.4) translateY(-10px);
                }
            }
            
            @keyframes pulse {
                0% {
                    filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.8)) drop-shadow(0 4px 12px rgba(0,0,0,0.5));
                }
                50% {
                    filter: drop-shadow(0 0 15px rgba(255, 255, 255, 1)) drop-shadow(0 4px 12px rgba(0,0,0,0.5));
                }
                100% {
                    filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.8)) drop-shadow(0 4px 12px rgba(0,0,0,0.5));
                }
            }
            
            .custom-marker > div {
                transition: all 0.3s ease;
            }
            
            .custom-marker > div svg {
                filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
            }
        `;
        document.head.appendChild(style);

        // Load Leaflet JS
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.async = true;
        document.head.appendChild(script);

        script.onload = () => {
            const L = (window as any).L;
            setLeaflet(L);

            if (mapRef.current && potholes.length > 0) {
                // Check if map is already initialized
                if (map) {
                    try {
                        map.remove();
                        setMap(null);
                    } catch (e) {
                        console.log('Removing existing map:', e);
                    }
                }
                
                // Small delay to ensure DOM is ready
                setTimeout(() => {
                    if (!mapRef.current) return;
                    
                    // Initialize map only once with zoom controls
                    const leafletMap = L.map(mapRef.current, {
                        center: [-1.15, 114.6],
                        zoom: 11,
                        zoomControl: true,
                        scrollWheelZoom: true,
                        doubleClickZoom: true,
                        touchZoom: true,
                    });

                    // Add OpenStreetMap tiles (FREE!)
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution:
                            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                        maxZoom: 19,
                        minZoom: 3,
                    }).addTo(leafletMap);

                    setMap(leafletMap);
                }, 100);
            }
        };

        return () => {
            if (map) {
                try {
                    map.off();
                    map.remove();
                } catch (e) {
                    console.log('Map cleanup error:', e);
                }
            }
        };
    }, [potholes.length]);

    // Update markers when filter changes - but keep ALL markers, just hide/show them
    useEffect(() => {
        if (!map || !leaflet) return;
        
        // Check if map container is still valid
        if (!map.getContainer()) {
            console.log('Map container not ready');
            return;
        }
        
        // Clear existing markers
        markers.forEach((marker) => {
            try {
                map.removeLayer(marker);
            } catch (e) {
                console.log('Error removing marker:', e);
            }
        });

        // If no potholes, clear markers and return
        if (potholes.length === 0) {
            setMarkers(new Map());
            return;
        }

        // Store markers in a Map for later reference
        const markersMap = new Map<number, any>();

        // Add markers for ALL potholes (not filtered)
        potholes.forEach((pothole) => {
            const lat = parseFloat(pothole.latitude);
            const lng = parseFloat(pothole.longitude);
            const gforce = parseFloat(pothole.gforce);

            // Check if this pothole matches the current filter
            const isVisible = matchesFilter(pothole);
            
            // Skip creating marker if not visible
            if (!isVisible) return;

            // Create custom PIN icon with color
            const color = getColorByGforce(gforce);
            const icon = leaflet.divIcon({
                className: 'custom-marker',
                html: `<div style="
                    position: relative;
                    width: 30px;
                    height: 40px;
                ">
                    <svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
                        <!-- Pin shadow -->
                        <ellipse cx="15" cy="38" rx="6" ry="2" fill="rgba(0,0,0,0.2)" />
                        <!-- Pin body -->
                        <path d="M15 0C9.5 0 5 4.5 5 10c0 8 10 25 10 25s10-17 10-25c0-5.5-4.5-10-10-10z" 
                              fill="${color}" 
                              stroke="white" 
                              stroke-width="2"/>
                        <!-- Pin center dot -->
                        <circle cx="15" cy="10" r="4" fill="white"/>
                    </svg>
                </div>`,
                iconSize: [30, 40],
                iconAnchor: [15, 40],
                popupAnchor: [0, -40],
            });

            try {
                const marker = leaflet.marker([lat, lng], { icon }).addTo(map);

                // Store marker reference
                markersMap.set(pothole.id, marker);

                // Add popup
                marker.bindPopup(`
                    <div style="min-width: 200px;">
                        <strong>Pothole #${pothole.id}</strong><br/>
                        <span style="color: ${color}; font-weight: bold;">
                            ${getSeverityLabel(gforce)} (${gforce})
                        </span><br/>
                        <small>${new Date(pothole.recorded_at).toLocaleString()}</small><br/>
                        <a href="${pothole.maps_link}" target="_blank" style="color: #2563eb;">
                            Buka di Google Maps →
                        </a>
                    </div>
                `);

                // Add click listener with smooth zoom animation
                marker.on('click', () => {
                    // Remove active class from all markers
                    markersMap.forEach((m) => {
                        const element = m.getElement();
                        if (element) {
                            element.classList.remove('active');
                        }
                    });

                    // Add active class to clicked marker
                    const element = marker.getElement();
                    if (element) {
                        element.classList.add('active');
                    }

                    // Smooth zoom animation: zoom out then zoom in
                    const currentZoom = map.getZoom();
                    const targetZoom = 17;
                    const intermediateZoom = Math.max(currentZoom - 3, 9);
                    
                    // First zoom out smoothly
                    map.flyTo([lat, lng], intermediateZoom, {
                        duration: 0.8,
                        easeLinearity: 0.25,
                    });
                    
                    // Then zoom in to target location smoothly
                    setTimeout(() => {
                        map.flyTo([lat, lng], targetZoom, {
                            duration: 1.2,
                            easeLinearity: 0.25,
                        });
                    }, 850);

                    setSelectedPothole(pothole);
                    setActiveMarkerId(pothole.id);
                });
            } catch (e) {
                console.log('Error adding marker:', e);
            }
        });

        // Save markers to state
        setMarkers(markersMap);

        // Calculate bounds only for visible markers
        const visiblePotholes = potholes.filter(matchesFilter);
        if (visiblePotholes.length > 0) {
            try {
                const bounds: [number, number][] = visiblePotholes.map((pothole) => [
                    parseFloat(pothole.latitude),
                    parseFloat(pothole.longitude),
                ]);
                map.fitBounds(bounds, { padding: [50, 50] });
            } catch (e) {
                console.log('Error fitting bounds:', e);
            }
        }
    }, [map, leaflet, severityFilter, potholes]);

    const getColorByGforce = (gforce: number): string => {
        if (gforce >= 1.15) return '#ef4444'; // red - severe
        if (gforce >= 1.05) return '#f97316'; // orange - moderate
        return '#eab308'; // yellow - mild
    };

    const getSeverityLabel = (gforce: number): string => {
        if (gforce >= 1.15) return 'Parah';
        if (gforce >= 1.05) return 'Sedang';
        return 'Ringan';
    };

    const getSeverityColor = (gforce: number): 'destructive' | 'default' | 'secondary' => {
        if (gforce >= 1.15) return 'destructive';
        if (gforce >= 1.05) return 'default';
        return 'secondary';
    };

    const openInGoogleMaps = (pothole: Pothole) => {
        window.open(pothole.maps_link, '_blank');
    };

    const focusOnMap = (pothole: Pothole) => {
        if (map && leaflet) {
            const lat = parseFloat(pothole.latitude);
            const lng = parseFloat(pothole.longitude);
            
            // Smooth zoom animation: zoom out then zoom in
            const currentZoom = map.getZoom();
            const targetZoom = 17;
            const intermediateZoom = Math.max(currentZoom - 3, 9);
            
            // First zoom out smoothly
            map.flyTo([lat, lng], intermediateZoom, {
                duration: 0.8,
                easeLinearity: 0.25,
            });
            
            // Then zoom in to target location smoothly
            setTimeout(() => {
                map.flyTo([lat, lng], targetZoom, {
                    duration: 1.2,
                    easeLinearity: 0.25,
                });
            }, 850);
            
            setSelectedPothole(pothole);

            // Remove active class from all markers
            markers.forEach((marker) => {
                const element = marker.getElement();
                if (element) {
                    element.classList.remove('active');
                }
            });

            // Add active class to the selected marker
            const selectedMarker = markers.get(pothole.id);
            if (selectedMarker) {
                const element = selectedMarker.getElement();
                if (element) {
                    element.classList.add('active');
                }
                // Open popup after zoom animation completes
                setTimeout(() => {
                    selectedMarker.openPopup();
                }, 2100);
            }

            setActiveMarkerId(pothole.id);
        }
    };

    // Haversine distance in meters between two [lat, lng] points
    const haversineDistance = (a: [number, number], b: [number, number]): number => {
        const toRad = (deg: number) => (deg * Math.PI) / 180;
        const R = 6371000; // earth radius in meters
        const dLat = toRad(b[0] - a[0]);
        const dLng = toRad(b[1] - a[1]);
        const lat1 = toRad(a[0]);
        const lat2 = toRad(b[0]);
        const h =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(h));
    };

    // Perpendicular distance in meters from point P to infinite line AB.
    // Uses an equirectangular projection – accurate enough for small areas.
    const perpendicularDistance = (
        p: [number, number],
        a: [number, number],
        b: [number, number]
    ): number => {
        const latScale = 111320; // meters per degree latitude
        const lngScale = 111320 * Math.cos((p[0] * Math.PI) / 180);
        const px = p[1] * lngScale;
        const py = p[0] * latScale;
        const ax = a[1] * lngScale;
        const ay = a[0] * latScale;
        const bx = b[1] * lngScale;
        const by = b[0] * latScale;
        const dx = bx - ax;
        const dy = by - ay;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
        return Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
    };

    // Returns the largest perpendicular deviation of the route from the
    // straight line between start/end. Big deviation = OSRM is detouring
    // sideways through unrelated roads.
    const maxRouteDeviation = (
        routeCoords: number[][],
        start: [number, number],
        end: [number, number]
    ): number => {
        let maxDev = 0;
        for (const c of routeCoords) {
            // OSRM geojson coords are [lng, lat]
            const p: [number, number] = [c[1], c[0]];
            const d = perpendicularDistance(p, start, end);
            if (d > maxDev) maxDev = d;
        }
        return maxDev;
    };

    // Function to fetch route from OSRM API
    const fetchRoute = async (start: [number, number], end: [number, number]) => {
        try {
            const response = await fetch(
                `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`
            );
            const data = await response.json();
            
            if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                return {
                    coordinates: data.routes[0].geometry.coordinates,
                    distance: data.routes[0].distance,
                    onRoad: true
                };
            }
            return null;
        } catch (error) {
            console.error('Error fetching route:', error);
            return null;
        }
    };

    // Function to draw routes between consecutive potholes
    const drawRoutes = async () => {
        if (!map || !leaflet || potholes.length < 2) return;
        
        // Clear existing route lines
        routeLines.forEach(line => {
            try {
                map.removeLayer(line);
            } catch (e) {
                console.log('Error removing route line:', e);
            }
        });
        
        const newRouteLines: any[] = [];
        const visiblePotholes = potholes.filter(matchesFilter);
        
        if (visiblePotholes.length < 2) {
            setRouteLines([]);
            return;
        }
        
        // Sort potholes by recorded_at to draw routes in chronological order
        const sortedPotholes = [...visiblePotholes].sort((a, b) => 
            new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
        );
        
        // Fetch all routes in parallel for faster loading
        const routePromises: Array<{
            startCoord: [number, number];
            endCoord: [number, number];
            routePromise: Promise<any>;
        }> = [];
        
        for (let i = 0; i < sortedPotholes.length - 1; i++) {
            const start = sortedPotholes[i];
            const end = sortedPotholes[i + 1];
            
            const startCoord: [number, number] = [parseFloat(start.latitude), parseFloat(start.longitude)];
            const endCoord: [number, number] = [parseFloat(end.latitude), parseFloat(end.longitude)];
            
            routePromises.push({
                startCoord,
                endCoord,
                routePromise: fetchRoute(startCoord, endCoord)
            });
        }
        
        // Wait for all routes to be fetched in parallel
        const routes = await Promise.all(routePromises.map(p => p.routePromise));
        
        // Draw all routes
        routes.forEach((route, index) => {
            const { startCoord, endCoord } = routePromises[index];
            const straightDistance = haversineDistance(startCoord, endCoord);

            // Decide whether OSRM's route is trustworthy or is a detour
            // through unrelated roads (case the user wants rendered as dashed).
            //
            // A route is treated as a "real" connecting road when ALL of:
            //   1. OSRM returned a route at all
            //   2. The route distance is not dramatically longer than the
            //      straight line (allows normal winding roads).
            //   3. The route doesn't swing far sideways from the straight line
            //      (detours typically zig-zag far off the A-B axis).
            //
            // Tunable thresholds – adjust if road network around the data is
            // unusually sparse or dense.
            const DETOUR_RATIO = 1.8;           // route <= 1.8x straight line
            const MAX_SIDE_DEVIATION_M = 400;   // absolute max sideways meters
            const MAX_SIDE_DEVIATION_RATIO = 0.4; // or <= 40% of straight line
            const MIN_STRAIGHT_DISTANCE = 30;   // < 30m: points are basically the same

            let isValidRoad = false;
            if (route && route.onRoad && straightDistance >= MIN_STRAIGHT_DISTANCE) {
                const ratioOk = route.distance <= straightDistance * DETOUR_RATIO;
                const deviation = maxRouteDeviation(route.coordinates, startCoord, endCoord);
                const deviationOk =
                    deviation <=
                    Math.max(MAX_SIDE_DEVIATION_M, straightDistance * MAX_SIDE_DEVIATION_RATIO);
                isValidRoad = ratioOk && deviationOk;
            }

            if (isValidRoad) {
                // Draw blue solid line for road route
                const routeCoords = route.coordinates.map((coord: number[]) => [coord[1], coord[0]]);
                const polyline = leaflet.polyline(routeCoords, {
                    color: '#3b82f6',
                    weight: 4,
                    opacity: 0.8,
                    smoothFactor: 1
                }).addTo(map);
                
                newRouteLines.push(polyline);
            } else {
                // Draw dashed line for direct connection (no suitable road / off-road)
                const polyline = leaflet.polyline([startCoord, endCoord], {
                    color: '#3b82f6',
                    weight: 3,
                    opacity: 0.8,
                    dashArray: '8, 10',
                    dashOffset: '0'
                }).addTo(map);
                
                newRouteLines.push(polyline);
            }
        });
        
        setRouteLines(newRouteLines);
    };

    // Toggle routes visibility
    const toggleRoutes = () => {
        if (showRoutes) {
            // Hide routes
            routeLines.forEach(line => {
                try {
                    map.removeLayer(line);
                } catch (e) {
                    console.log('Error removing route:', e);
                }
            });
            setRouteLines([]);
            setShowRoutes(false);
        } else {
            // Show routes
            setShowRoutes(true);
            drawRoutes();
        }
    };

    // Auto-draw routes when map is ready and when filter changes
    useEffect(() => {
        if (showRoutes && map && leaflet && potholes.length >= 2) {
            drawRoutes();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [severityFilter, showRoutes, map, leaflet, potholes.length]);

    return (
        <AppSidebarLayout breadcrumbs={[{ label: 'Dashboard' }]}>
            <Head title="Dashboard - Deteksi Lubang Jalan" />

            {/* Loading Data Animation */}
            {isLoadingData && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="text-center">
                        <DotLottieReact
                            src="https://lottie.host/0608a634-c460-4761-9051-48540700a6b7/XNVvVvvu6m.lottie"
                            loop
                            autoplay
                            style={{ width: 400, height: 400, margin: '0 auto' }}
                        />
                        <p className="mt-4 text-xl font-semibold text-white">Memuat Data...</p>
                        <p className="mt-2 text-sm text-gray-300">Mohon tunggu sebentar</p>
                    </div>
                </div>
            )}

            {/* Statistics Dialog */}
            <Dialog open={showStatsDialog} onOpenChange={setShowStatsDialog}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl">Statistik Data Lubang Jalan</DialogTitle>
                        <DialogDescription>
                            Ringkasan kondisi lubang jalan berdasarkan tingkat kerusakan
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                        {/* Rusak Berat */}
                        <Card className="border-red-200 bg-red-50/50">
                            <CardContent className="pt-6">
                                <div className="text-center space-y-4">
                                    <DotLottieReact
                                        src="https://lottie.host/be33974e-e59d-448b-9754-9bf87e0250dc/0szTNI5KYS.lottie"
                                        loop
                                        autoplay
                                        style={{ width: 120, height: 120, margin: '0 auto' }}
                                    />
                                    <div>
                                        <h3 className="text-lg font-semibold text-red-700">Rusak Berat</h3>
                                        <p className="text-sm text-red-600 mb-3">G-Force ≥ 1.15</p>
                                        <div className="text-4xl font-bold text-red-700">
                                            {potholes.filter(p => parseFloat(p.gforce) >= 1.15).length}
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {potholes.length > 0 ? ((potholes.filter(p => parseFloat(p.gforce) >= 1.15).length / potholes.length) * 100).toFixed(1) : 0}% dari total
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Rusak Sedang */}
                        <Card className="border-orange-200 bg-orange-50/50">
                            <CardContent className="pt-6">
                                <div className="text-center space-y-4">
                                    <DotLottieReact
                                        src="https://lottie.host/93c6e0a1-db84-421c-94aa-64db6e2703cd/J2nxLCmoxp.lottie"
                                        loop
                                        autoplay
                                        style={{ width: 120, height: 120, margin: '0 auto' }}
                                    />
                                    <div>
                                        <h3 className="text-lg font-semibold text-orange-700">Rusak Sedang</h3>
                                        <p className="text-sm text-orange-600 mb-3">1.05 ≤ G-Force &lt; 1.15</p>
                                        <div className="text-4xl font-bold text-orange-700">
                                            {potholes.filter(p => {
                                                const gf = parseFloat(p.gforce);
                                                return gf >= 1.05 && gf < 1.15;
                                            }).length}
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {potholes.length > 0 ? ((potholes.filter(p => {
                                                const gf = parseFloat(p.gforce);
                                                return gf >= 1.05 && gf < 1.15;
                                            }).length / potholes.length) * 100).toFixed(1) : 0}% dari total
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Rusak Ringan */}
                        <Card className="border-yellow-200 bg-yellow-50/50">
                            <CardContent className="pt-6">
                                <div className="text-center space-y-4">
                                    <DotLottieReact
                                        src="https://lottie.host/47171dc5-8c34-4425-a835-6e7a19a5a06b/gn6vAGhm6D.lottie"
                                        loop
                                        autoplay
                                        style={{ width: 120, height: 120, margin: '0 auto' }}
                                    />
                                    <div>
                                        <h3 className="text-lg font-semibold text-yellow-700">Rusak Ringan</h3>
                                        <p className="text-sm text-yellow-600 mb-3">G-Force &lt; 1.05</p>
                                        <div className="text-4xl font-bold text-yellow-700">
                                            {potholes.filter(p => parseFloat(p.gforce) < 1.05).length}
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {potholes.length > 0 ? ((potholes.filter(p => parseFloat(p.gforce) < 1.05).length / potholes.length) * 100).toFixed(1) : 0}% dari total
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Total Summary */}
                    <Card className="mt-4 bg-primary/5 border-primary/20">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold">Total Lubang Jalan Terdeteksi</h3>
                                    <p className="text-sm text-muted-foreground">
                                        File: {activeFile?.original_filename}
                                    </p>
                                </div>
                                <div className="text-5xl font-bold text-primary">
                                    {potholes.length}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end mt-4">
                        <Button onClick={() => setShowStatsDialog(false)}>
                            Tutup
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <div className="space-y-6">
                <Heading 
                    title="Dashboard Deteksi Lubang Jalan"
                    description="Monitoring dan visualisasi lokasi lubang jalan yang terdeteksi"
                />

                {/* File Selector Card */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <FileText className="w-5 h-5 text-muted-foreground" />
                                <div>
                                    <p className="text-sm font-medium">
                                        {activeFile ? activeFile.original_filename : 'Belum ada file dipilih'}
                                    </p>
                                    {activeFile && (
                                        <p className="text-xs text-muted-foreground">
                                            {activeFile.total_records} records • Diimport: {new Date(activeFile.imported_at!).toLocaleString('id-ID')}
                                        </p>
                                    )}
                                </div>
                                {activeFile && (
                                    <Badge variant="default">
                                        {activeFile.total_records} data aktif
                                    </Badge>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                {activeFile && potholes.length > 0 && (
                                    <Button variant="outline" size="sm" onClick={handleDownload}>
                                        <Download className="w-4 h-4 mr-2" />
                                        Download Data
                                    </Button>
                                )}
                                <Dialog open={isFileDialogOpen} onOpenChange={setIsFileDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button>
                                            <FolderOpen className="w-4 h-4 mr-2" />
                                            Pilih File Data
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                    <DialogHeader>
                                        <DialogTitle>Pilih File Data</DialogTitle>
                                        <DialogDescription>
                                            Pilih file untuk ditampilkan di dashboard. Data lama akan diganti dengan data dari file yang dipilih.
                                        </DialogDescription>
                                    </DialogHeader>

                                    <div className="space-y-3 mt-4">
                                        {files.length === 0 ? (
                                            <div className="text-center py-8">
                                                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                                                <p className="text-muted-foreground mb-4">Belum ada file yang diupload</p>
                                                <Button onClick={handleUploadClick}>
                                                    <UploadIcon className="w-4 h-4 mr-2" />
                                                    Upload File Baru
                                                </Button>
                                            </div>
                                        ) : (
                                            <>
                                                {files.map((file) => (
                                                    <div
                                                        key={file.id}
                                                        className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-all hover:border-primary hover:bg-accent ${
                                                            file.is_imported ? 'border-primary bg-primary/5' : ''
                                                        }`}
                                                        onClick={() => handleFileSelect(file.id, file.is_imported)}
                                                    >
                                                        <div className="flex items-center gap-3 flex-1">
                                                            <div className={`p-2 rounded-lg ${file.is_imported ? 'bg-primary/10' : 'bg-muted'}`}>
                                                                <FileText className={`w-5 h-5 ${file.is_imported ? 'text-primary' : 'text-muted-foreground'}`} />
                                                            </div>
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2">
                                                                    <h4 className="font-medium">{file.original_filename}</h4>
                                                                    {file.is_imported && (
                                                                        <Badge variant="default" className="gap-1">
                                                                            <CheckCircle2 className="w-3 h-3" />
                                                                            Aktif
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                                                                    <span>{file.total_records} records</span>
                                                                    <span>•</span>
                                                                    <span>Upload: {new Date(file.created_at).toLocaleDateString('id-ID')}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {!file.is_imported && (
                                                            <Button size="sm" variant="outline">
                                                                Load Data
                                                            </Button>
                                                        )}
                                                    </div>
                                                ))}

                                                <div className="pt-3 border-t">
                                                    <Button 
                                                        variant="outline" 
                                                        className="w-full"
                                                        onClick={handleUploadClick}
                                                    >
                                                        <UploadIcon className="w-4 h-4 mr-2" />
                                                        Upload File Baru
                                                    </Button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
                    <Card>
                        <CardHeader>
                            <CardTitle>Total Lubang</CardTitle>
                            <CardDescription>Lokasi terdeteksi</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">
                                {activeFile ? potholes.length : 0}
                            </div>
                            {!activeFile && (
                                <p className="text-xs text-muted-foreground mt-2">
                                    Pilih file untuk melihat data
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Kondisi Parah</CardTitle>
                            <CardDescription>G-Force ≥ 1.15</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-red-600">
                                {activeFile ? potholes.filter((p) => parseFloat(p.gforce) >= 1.15).length : 0}
                            </div>
                            {!activeFile && (
                                <p className="text-xs text-muted-foreground mt-2">
                                    Pilih file untuk melihat data
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Kondisi Sedang</CardTitle>
                            <CardDescription>G-Force 1.05 - 1.14</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-orange-600">
                                {activeFile ? potholes.filter((p) => {
                                    const gforce = parseFloat(p.gforce);
                                    return gforce >= 1.05 && gforce < 1.15;
                                }).length : 0}
                            </div>
                            {!activeFile && (
                                <p className="text-xs text-muted-foreground mt-2">
                                    Pilih file untuk melihat data
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Kondisi Ringan</CardTitle>
                            <CardDescription>G-Force &lt; 1.05</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-yellow-600">
                                {activeFile ? potholes.filter((p) => parseFloat(p.gforce) < 1.05).length : 0}
                            </div>
                            {!activeFile && (
                                <p className="text-xs text-muted-foreground mt-2">
                                    Pilih file untuk melihat data
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Deteksi Terakhir</CardTitle>
                            <CardDescription>Paling baru</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm">
                                {activeFile && potholes.length > 0
                                    ? new Date(potholes[0].recorded_at).toLocaleString('id-ID')
                                    : 'Tidak ada data'}
                            </div>
                            {!activeFile && (
                                <p className="text-xs text-muted-foreground mt-2">
                                    Pilih file untuk melihat data
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {potholes.length === 0 ? (
                    <Card>
                        <CardContent className="py-12">
                            <div className="text-center">
                                <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                                <h3 className="text-lg font-semibold mb-2">Belum Ada Data</h3>
                                <p className="text-muted-foreground mb-4">
                                    Pilih file dari dropdown di atas atau upload file baru untuk menampilkan peta
                                </p>
                                <Button onClick={() => router.visit('/files')}>
                                    <UploadIcon className="w-4 h-4 mr-2" />
                                    Upload File
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                <>
                <div className="grid gap-6 lg:grid-cols-3">
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Peta Lokasi</CardTitle>
                                    <CardDescription>
                                        Klik marker untuk detail. Warna: 🔴 Parah, 🟠 Sedang, 🟡 Ringan
                                    </CardDescription>
                                </div>
                                <Button
                                    variant={showRoutes ? "default" : "outline"}
                                    size="sm"
                                    onClick={toggleRoutes}
                                    disabled={potholes.length < 2}
                                >
                                    {showRoutes ? 'Sembunyikan Rute' : 'Tampilkan Rute'}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div ref={mapRef} className="w-full h-[600px] rounded-lg border relative z-0" />
                            
                            <p className="text-xs text-muted-foreground mt-2">
                                {showRoutes && (
                                    <span>
                                        <span className="inline-block w-8 h-0.5 bg-blue-500 mr-1 align-middle"></span>
                                        Rute di jalan raya
                                        <span className="inline-block w-8 h-0.5 bg-white border-t-2 border-dashed ml-3 mr-1 align-middle"></span>
                                        Koneksi langsung
                                    </span>
                                )}
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="lg:col-span-1">
                        <CardHeader>
                            <CardTitle>
                                {selectedPothole ? `Lubang #${selectedPothole.id}` : 'Pilih Marker'}
                            </CardTitle>
                            <CardDescription>
                                {selectedPothole ? 'Detail Informasi' : 'Klik marker untuk melihat detail'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {selectedPothole ? (
                                <div className="space-y-4">
                                    <div>
                                        <div className="text-sm font-medium text-muted-foreground">Tingkat Keparahan</div>
                                        <Badge
                                            variant={getSeverityColor(parseFloat(selectedPothole.gforce))}
                                            className="mt-1"
                                        >
                                            {getSeverityLabel(parseFloat(selectedPothole.gforce))}
                                        </Badge>
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-muted-foreground">G-Force</div>
                                        <div className="text-lg font-semibold">{selectedPothole.gforce}</div>
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-muted-foreground">Koordinat</div>
                                        <div className="text-sm">
                                            Lat: {selectedPothole.latitude}
                                            <br />
                                            Lng: {selectedPothole.longitude}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-muted-foreground">Waktu Deteksi</div>
                                        <div className="text-sm">
                                            {new Date(selectedPothole.recorded_at).toLocaleString('id-ID')}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Button        onClick={() => openInGoogleMaps(selectedPothole)}
                                            className="w-full"
                                            variant="default"
                                        >
                                            <ExternalLink className="w-4 h-4 mr-2" />
                                            Buka di Google Maps
                                        </Button>
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={handleEditFromSidebar}
                                                className="flex-1"
                                                variant="outline"
                                            >
                                                <Edit className="w-4 h-4 mr-2" />
                                                Edit
                                            </Button>
                                            <Button
                                                onClick={handleDeleteFromSidebar}
                                                className="flex-1"
                                                variant="destructive"
                                            >
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                Hapus
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-sm text-muted-foreground">
                                    Klik marker di peta untuk melihat informasi detail tentang lubang jalan tersebut.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Deteksi Terbaru</CardTitle>
                                <CardDescription>
                                    Menampilkan {Math.min(itemsPerPage, potholes.filter(matchesFilter).length - (currentPage - 1) * itemsPerPage)} dari {potholes.filter(matchesFilter).length} lubang jalan
                                </CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant={severityFilter === 'all' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => {
                                        setSeverityFilter('all');
                                        setCurrentPage(1);
                                    }}
                                >
                                    Semua
                                </Button>
                                <Button
                                    variant={severityFilter === 'severe' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => {
                                        setSeverityFilter('severe');
                                        setCurrentPage(1);
                                    }}
                                    className={severityFilter === 'severe' ? 'bg-red-600 hover:bg-red-700' : ''}
                                >
                                    Parah
                                </Button>
                                <Button
                                    variant={severityFilter === 'moderate' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => {
                                        setSeverityFilter('moderate');
                                        setCurrentPage(1);
                                    }}
                                    className={severityFilter === 'moderate' ? 'bg-orange-600 hover:bg-orange-700' : ''}
                                >
                                    Sedang
                                </Button>
                                <Button
                                    variant={severityFilter === 'mild' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => {
                                        setSeverityFilter('mild');
                                        setCurrentPage(1);
                                    }}
                                    className={severityFilter === 'mild' ? 'bg-yellow-600 hover:bg-yellow-700' : ''}
                                >
                                    Ringan
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {potholes
                                .filter(matchesFilter)
                                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                                .map((pothole) => (
                                <div
                                    key={pothole.id}
                                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                                    onClick={() => focusOnMap(pothole)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div
                                            className="w-3 h-3 rounded-full"
                                            style={{
                                                backgroundColor: getColorByGforce(parseFloat(pothole.gforce)),
                                            }}
                                        />
                                        <div>
                                            <div className="font-medium">Lubang #{pothole.id}</div>
                                            <div className="text-sm text-muted-foreground">
                                                {pothole.latitude}, {pothole.longitude}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right flex items-center gap-2">
                                        <div>
                                            <Badge variant={getSeverityColor(parseFloat(pothole.gforce))}>
                                                {pothole.gforce}
                                            </Badge>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {new Date(pothole.recorded_at).toLocaleDateString('id-ID')}
                                            </div>
                                        </div>
                                        <Button
                                            key={`edit-${pothole.id}`}
                                            size="sm"
                                            variant="ghost"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleEdit(pothole);
                                            }}
                                        >
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            key={`maps-${pothole.id}`}
                                            size="sm"
                                            variant="ghost"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openInGoogleMaps(pothole);
                                            }}
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            key={`delete-${pothole.id}`}
                                            size="sm"
                                            variant="ghost"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(pothole.id);
                                            }}
                                        >
                                            <Trash2 className="w-4 h-4 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        {/* Pagination */}
                        {potholes.filter(matchesFilter).length > itemsPerPage && (
                            <div className="flex items-center justify-between mt-4 pt-4 border-t">
                                <div className="text-sm text-muted-foreground">
                                    Halaman {currentPage} dari {Math.ceil(potholes.filter(matchesFilter).length / itemsPerPage)}
                                </div>
                                <div className="flex gap-1">
                                    {/* Previous button */}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(currentPage - 1)}
                                        disabled={currentPage === 1}
                                    >
                                        ‹
                                    </Button>
                                    
                                    {/* Page numbers */}
                                    {(() => {
                                        const totalPages = Math.ceil(potholes.filter(matchesFilter).length / itemsPerPage);
                                        const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
                                            .filter((page) => {
                                                // Show first page, last page, current page, and pages around current
                                                if (page === 1 || page === totalPages) return true;
                                                if (page >= currentPage - 1 && page <= currentPage + 1) return true;
                                                return false;
                                            });
                                        
                                        const elements: JSX.Element[] = [];
                                        pages.forEach((page, index) => {
                                            // Add ellipsis if there's a gap
                                            const prevPage = pages[index - 1];
                                            if (prevPage && page - prevPage > 1) {
                                                elements.push(
                                                    <span key={`ellipsis-${prevPage}-${page}`} className="px-2 py-1 text-sm text-muted-foreground">
                                                        ...
                                                    </span>
                                                );
                                            }
                                            
                                            elements.push(
                                                <Button
                                                    key={`page-${page}`}
                                                    variant={currentPage === page ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => setCurrentPage(page)}
                                                    className="min-w-[2.5rem]"
                                                >
                                                    {page}
                                                </Button>
                                            );
                                        });
                                        
                                        return elements;
                                    })()}
                                    
                                    {/* Next button */}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(currentPage + 1)}
                                        disabled={currentPage === Math.ceil(potholes.filter(matchesFilter).length / itemsPerPage)}
                                    >
                                        ›
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
                </>
                )}

                {/* Edit Dialog */}
                <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Edit Data Lubang</DialogTitle>
                            <DialogDescription>
                                Edit informasi lubang jalan #{editingPothole?.id}
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleUpdate} className="space-y-4">
                            <div>
                                <Label htmlFor="latitude">Latitude</Label>
                                <Input
                                    id="latitude"
                                    type="number"
                                    step="any"
                                    value={data.latitude}
                                    onChange={(e) => setData('latitude', e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="longitude">Longitude</Label>
                                <Input
                                    id="longitude"
                                    type="number"
                                    step="any"
                                    value={data.longitude}
                                    onChange={(e) => setData('longitude', e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="gforce">G-Force</Label>
                                <Input
                                    id="gforce"
                                    type="number"
                                    step="any"
                                    value={data.gforce}
                                    onChange={(e) => setData('gforce', e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="recorded_at">Waktu Deteksi</Label>
                                <Input
                                    id="recorded_at"
                                    type="datetime-local"
                                    value={data.recorded_at}
                                    onChange={(e) => setData('recorded_at', e.target.value)}
                                    required
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                                    Batal
                                </Button>
                                <Button type="submit" disabled={processing}>
                                    {processing ? 'Menyimpan...' : 'Simpan'}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </AppSidebarLayout>
    );
}
