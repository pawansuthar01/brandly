type SurfaceToken = 'surface' | 'surfaceRaised' | 'surfaceHero' | 'surfaceMuted' | 'surfaceSky' | 'surfaceMint' | 'surfaceButter' | 'surfaceBlush' | 'surfaceLilac';

export const surfaceColors: Record<'light' | 'dark', Record<SurfaceToken, string>> = {
  light: {
    surface: '#FAFDFE', surfaceRaised: '#FAFDFE', surfaceHero: '#F2F7FE', surfaceMuted: '#C7EBC5',
    surfaceSky: '#C2E0FD', surfaceMint: '#AAEDE3', surfaceButter: '#F7E0AF', surfaceBlush: '#FED8B7', surfaceLilac: '#F8D3F7',
  },
  dark: {
    surface: '#211D2C', surfaceRaised: '#282333', surfaceHero: '#282333', surfaceMuted: '#2B2A3D',
    surfaceSky: '#273547', surfaceMint: '#263F37', surfaceButter: '#2B2A32', surfaceBlush: '#3B2C38', surfaceLilac: '#39334F',
  },
} as const;
