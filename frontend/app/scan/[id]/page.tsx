'use client';

import { useState, useRef, useCallback, type ComponentType, type Ref } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Camera, Check, Loader2, AlertCircle,
    Flashlight, FlashlightOff, ArrowLeft, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { scanMeter } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';

type WebcamOuterProps = {
    audio: boolean;
    ref: Ref<{ getScreenshot: () => string | null } | null>;
    screenshotFormat: string;
    screenshotQuality: number;
    videoConstraints: MediaTrackConstraints;
    onUserMedia: (stream: MediaStream) => void;
    onUserMediaError: () => void;
    className?: string;
};

const Webcam = dynamic(
    () => import('@/components/Webcam'),
    { ssr: false }
) as ComponentType<WebcamOuterProps>;

interface ScanResult {
    reading: {
        current: number;
        previous: number;
        units: number;
        cost: number;
    };
    invoice: {
        total_due: number;
        electric_amount: number;
    };
}

export default function ScanPage() {
    const params = useParams();
    const router = useRouter();
    const tenantId = params.id as string;
    const webcamRef = useRef<{ getScreenshot: () => string | null } | null>(null);

    const [cameraReady, setCameraReady] = useState(false);
    const [isFlashOn, setIsFlashOn] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<ScanResult | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);

    const handleUserMedia = useCallback((mediaStream: MediaStream) => {
        setStream(mediaStream);
        setCameraReady(true);
    }, []);

    const toggleFlash = useCallback(async () => {
        if (!stream) return;
        const videoTrack = stream.getVideoTracks()[0];
        if (!videoTrack) return;

        try {
            const capabilities = videoTrack.getCapabilities() as MediaTrackCapabilities & {
                torch?: boolean;
            };
            if (capabilities.torch) {
                await videoTrack.applyConstraints({
                    advanced: [{ torch: !isFlashOn }],
                } as unknown as MediaTrackConstraints);
                setIsFlashOn(!isFlashOn);
            } else {
                setError('Flashlight not available');
                setTimeout(() => setError(null), 2000);
            }
        } catch {
            setError('Failed to toggle flash');
            setTimeout(() => setError(null), 2000);
        }
    }, [isFlashOn, stream]);

    const captureAndScan = useCallback(async () => {
        if (!webcamRef.current) return;

        setScanning(true);
        setError(null);

        try {
            const imageSrc = webcamRef.current.getScreenshot();
            if (!imageSrc) throw new Error('Failed to capture');

            const response = await fetch(imageSrc);
            const blob = await response.blob();

            const data = await scanMeter(parseInt(tenantId), blob);
            setResult(data);
        } catch (err: unknown) {
            setError(getErrorMessage(err) || 'Scan failed');
        } finally {
            setScanning(false);
        }
    }, [tenantId]);

    const videoConstraints = {
        facingMode: { exact: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
    };

    const handleDone = () => {
        router.push(`/tenant/${tenantId}/`);
    };

    return (
        <main className="fixed inset-0 bg-black">
            {/* Camera */}
            <div className="absolute inset-0">
                <Webcam
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    screenshotQuality={0.9}
                    videoConstraints={videoConstraints}
                    onUserMedia={handleUserMedia}
                    onUserMediaError={() => setError('Camera access denied')}
                    className="w-full h-full object-cover"
                />
            </div>

            {/* Guide Overlay */}
            {cameraReady && !scanning && !result && (
                <div className="scanner-overlay">
                    <div className="scanner-guide-box" />
                </div>
            )}

            {/* Header */}
            <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-10">
                <div className="flex items-center justify-between">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="w-6 h-6" />
                    </Button>
                    <h1 className="text-lg font-bold">Scan Meter</h1>
                    <Button variant="ghost" size="icon" onClick={toggleFlash} disabled={!cameraReady}>
                        {isFlashOn ? (
                            <Flashlight className="w-6 h-6 text-yellow-400" />
                        ) : (
                            <FlashlightOff className="w-6 h-6" />
                        )}
                    </Button>
                </div>
                {cameraReady && !result && (
                    <p className="text-center text-sm text-white/70 mt-2">
                        Position the meter display inside the green box
                    </p>
                )}
            </div>

            {/* Scanning Overlay */}
            <AnimatePresence>
                {scanning && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20"
                    >
                        <div className="spinner mb-4" />
                        <p className="text-xl font-bold">🤖 AI is reading...</p>
                        <p className="text-muted-foreground mt-2">Analyzing meter display</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Error Message */}
            {error && !result && (
                <div className="absolute top-24 left-4 right-4 z-20">
                    <div className="p-3 rounded-lg bg-destructive/90 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        <span>{error}</span>
                    </div>
                </div>
            )}

            {/* Bottom Controls */}
            {!result && (
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent safe-bottom">
                    <div className="flex justify-center">
                        <Button
                            size="lg"
                            className="h-16 w-16 rounded-full shadow-2xl shadow-primary/50"
                            onClick={captureAndScan}
                            disabled={!cameraReady || scanning}
                        >
                            {scanning ? (
                                <Loader2 className="w-8 h-8 animate-spin" />
                            ) : (
                                <Camera className="w-8 h-8" />
                            )}
                        </Button>
                    </div>
                </div>
            )}

            {/* Result Modal */}
            <AnimatePresence>
                {result && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 bg-black/90 flex items-center justify-center p-4 z-30"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.1 }}
                            className="w-full max-w-sm"
                        >
                            <Card className="card-premium">
                                <CardContent className="pt-6">
                                    {/* Success Icon */}
                                    <div className="text-center mb-6">
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: 'spring', delay: 0.2 }}
                                            className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-4"
                                        >
                                            <Check className="w-8 h-8 text-green-400" />
                                        </motion.div>
                                        <h2 className="text-2xl font-bold">Scan Complete!</h2>
                                    </div>

                                    {/* Reading Info */}
                                    <div className="bg-secondary/50 rounded-xl p-4 mb-4">
                                        <div className="grid grid-cols-3 gap-4 text-center">
                                            <div>
                                                <p className="text-xs text-muted-foreground">Previous</p>
                                                <p className="text-xl font-bold">{result.reading.previous}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">Current</p>
                                                <p className="text-xl font-bold text-primary">{result.reading.current}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">Units</p>
                                                <p className="text-xl font-bold text-yellow-400">{result.reading.units}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Electric Cost */}
                                    <div className="flex items-center justify-between p-4 bg-primary/10 rounded-xl mb-4">
                                        <div className="flex items-center gap-2">
                                            <Zap className="w-5 h-5 text-yellow-400" />
                                            <span>Electric Bill</span>
                                        </div>
                                        <span className="text-xl font-bold text-primary">৳{result.reading.cost.toFixed(0)}</span>
                                    </div>

                                    {/* Total */}
                                    <div className="text-center py-4 border-t border-border">
                                        <p className="text-sm text-muted-foreground mb-1">Updated Total Due</p>
                                        <p className="text-3xl font-bold text-primary">৳{result.invoice.total_due.toFixed(0)}</p>
                                    </div>

                                    <Button className="w-full mt-4" size="lg" onClick={handleDone}>
                                        Done
                                    </Button>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </main>
    );
}
