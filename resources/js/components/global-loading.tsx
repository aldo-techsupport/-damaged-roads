import { DotLottieReact } from '@lottiefiles/dotlottie-react';

export default function GlobalLoading() {
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-sm">
            <div className="text-center">
                <DotLottieReact
                    src="https://lottie.host/9d5ebaf4-878e-45d4-850c-764690b09c96/MAOi52emoT.lottie"
                    loop
                    autoplay
                    style={{ width: 300, height: 300, margin: '0 auto' }}
                />
                <p className="mt-4 text-xl font-semibold">Memuat...</p>
                <p className="mt-2 text-sm text-muted-foreground">Mohon tunggu sebentar</p>
            </div>
        </div>
    );
}
