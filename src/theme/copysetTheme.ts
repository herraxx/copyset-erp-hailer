// This app is an exact port of an existing external product (Copy-Set ERP —
// see copyset-erp.zip). The Hailer base theme's default Button styling
// (uppercase, letter-spaced, fully pill-shaped) is correct for generic
// Hailer-native apps, but it directly contradicts the reference's own button
// language (normal case, 8px corners, tighter tracking — src/styles.css
// `.btn{border-radius:8px;font-weight:700;line-height:1.3}`). Since matching
// the reference pixel-for-pixel is this app's explicit brief, override the
// Button baseStyle here rather than the vendored theme file.
import { extendTheme } from '@chakra-ui/react';
import hailerTheme from '../hailer/theme/theme';

const copysetTheme = extendTheme(hailerTheme, {
  components: {
    Button: {
      baseStyle: {
        textTransform: 'none',
        letterSpacing: 'normal',
        fontWeight: 700,
        borderRadius: '8px',
        lineHeight: 1.3,
      },
    },
  },
});

export default copysetTheme;
