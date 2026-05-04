import { Head } from '@inertiajs/react';
import { AppShell } from '@/components/app-shell';
import Heading from '@/components/heading';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';

interface Pothole {
    id: number;
    latitude: string;
    longitude: string;
    gforce: string;
    recorded_at: string;
    maps_link: string;
}

interface DashboardProps {
    potholes: Pothole[];
}

export default function Dashboard({ potholes }: DashboardProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const [map, setMap] = useState<google.maps.Map | null>(null);
    const [selectedPothole, setSelectedPothole] = useState<Pothole | null>(null);

    useEffect(() => {
        // Load Google Maps API
        const script = document.createElement('script');
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'YOUR_GOOGLE_MAPS_API_KEY';
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);

        script.onload = () => {
            if (mapRef.current && potholes.length > 0) {
                // Initialize map centered on first pothole
                const firstPothole = potholes[0];
                const center = {
                    lat: parseFloat(firstPothole.latitude),
                    lng: parseFloat(firstPothole.longitude),
                };

                const googleMap = new google.maps.Map(mapRef.current, {
                    zoom: 12,
                    center: center,
                    mapTypeId: google.maps.MapTypeId.ROADMAP,
                });

                setMap(googleMap);

                // Add markers for all potholes
                potholes.forEach((pothole) => {
                    const marker = new google.maps.Marker({
                        position: {
                            lat: parseFloat(pothole.latitude),
                            lng: parseFloat(pothole.longitude),
                        },
                        map: googleMap,
                        title: `Pothole #${pothole.id}`,
                        icon: {
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 8,
                            fillColor: getColorByGforce(parseFloat(pothole.gforce)),
                            fillOpacity: 0.8,
                            strokeColor: '#ffffff',
                            strokeWeight: 2,
                        },
                    });

                    // Add click listener to marker
                    marker.addListener('click', () => {
                        setSelectedPothole(pothole);
                        googleMap.panTo(marker.getPosition()!);
                        googleMap.setZoom(15);
                    });
                });
            }
        };

        return () => {
            document.head.removeChild(script);
        };
    }, [potholes]);

    const getColorByGforce = (gforce: number): string => {
        if (gforce >= 1.15) return '#ef4444'; // red - severe
        if (gforce >= 1.05) return '#f97316'; // orange - moderate
        return '#eab308'; // yellow - mild
    };

    const getSeverityLabel = (gforce: number): string => {
        if (gforce >= 1.15) return 'Severe';
        if (gforce >= 1.05) return 'Moderate';
        return 'Mild';
    };

    const getSeverityColor = (gforce: number): 'destructive' | 'default' | 'secondary' => {
        if (gforce >= 1.15) return 'destructive';
        if (gforce >= 1.05) return 'default';
        return 'secondary';
    };

    return (
        <AppShell>
            <Head title="Dashboard - Pothole Detection" />

            <div className="space-y-6">
                <Heading 
                    title="Pothole Detection Dashboard"
                    description="Monitoring and visualization of detected potholes"
                />

                <div className="grid gap-6 md:grid-cols-3">
                    <Card>
                        <CardHeader>
                            <CardTitle>Total Potholes</CardTitle>
                            <CardDescription>Detected locations</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{potholes.length}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Severe Cases</CardTitle>
                            <CardDescription>G-Force ≥ 1.15</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-red-600">
                                {potholes.filter((p) => parseFloat(p.gforce) >= 1.15).length}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Latest Detection</CardTitle>
                            <CardDescription>Most recent</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm">
                                {potholes.length > 0
                                    ? new Date(potholes[0].recorded_at).toLocaleString()
                                    : 'No data'}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle>Map View</CardTitle>
                            <CardDescription>
                                Click on markers to view details. Colors indicate severity: Red (Severe), Orange
                                (Moderate), Yellow (Mild)
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div ref={mapRef} className="w-full h-[600px] rounded-lg" />
                        </CardContent>
                    </Card>

                    <Card className="lg:col-span-1">
                        <CardHeader>
                            <CardTitle>
                                {selectedPothole ? `Pothole #${selectedPothole.id}` : 'Select a Marker'}
                            </CardTitle>
                            <CardDescription>
                                {selectedPothole ? 'Details' : 'Click on a marker to view details'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {selectedPothole ? (
                                <div className="space-y-4">
                                    <div>
                                        <div className="text-sm font-medium text-muted-foreground">Severity</div>
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
                                        <div className="text-sm font-medium text-muted-foreground">Location</div>
                                        <div className="text-sm">
                                            Lat: {selectedPothole.latitude}
                                            <br />
                                            Lng: {selectedPothole.longitude}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-muted-foreground">Detected At</div>
                                        <div className="text-sm">
                                            {new Date(selectedPothole.recorded_at).toLocaleString()}
                                        </div>
                                    </div>
                                    <div>
                                        <a
                                            href={selectedPothole.maps_link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-blue-600 hover:underline"
                                        >
                                            View on Google Maps →
                                        </a>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-sm text-muted-foreground">
                                    Click on any marker on the map to view detailed information about that pothole
                                    detection.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Recent Detections</CardTitle>
                        <CardDescription>Latest 10 pothole detections</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {potholes.slice(0, 10).map((pothole) => (
                                <div
                                    key={pothole.id}
                                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer"
                                    onClick={() => {
                                        setSelectedPothole(pothole);
                                        if (map) {
                                            map.panTo({
                                                lat: parseFloat(pothole.latitude),
                                                lng: parseFloat(pothole.longitude),
                                            });
                                            map.setZoom(15);
                                        }
                                    }}
                                >
                                    <div className="flex items-center gap-4">
                                        <div
                                            className="w-3 h-3 rounded-full"
                                            style={{
                                                backgroundColor: getColorByGforce(parseFloat(pothole.gforce)),
                                            }}
                                        />
                                        <div>
                                            <div className="font-medium">Pothole #{pothole.id}</div>
                                            <div className="text-sm text-muted-foreground">
                                                {pothole.latitude}, {pothole.longitude}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <Badge variant={getSeverityColor(parseFloat(pothole.gforce))}>
                                            {pothole.gforce}
                                        </Badge>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            {new Date(pothole.recorded_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AppShell>
    );
}
