import { useWindowDimensions } from 'react-native';

interface Breakpoint {
    isMobile: boolean;
    isDesktop: boolean;
    width: number;
    height: number;
}

const DESKTOP_BREAKPOINT = 768;

export function useBreakpoint(): Breakpoint {
    const { width, height } = useWindowDimensions();

    return {
        isMobile: width < DESKTOP_BREAKPOINT,
        isDesktop: width >= DESKTOP_BREAKPOINT,
        width,
        height,
    };
}
