export function hex2rgb(hex) {
    // Input validation
    if (typeof hex !== 'string') {
        throw new Error('Input must be a string');
    }

    // Remove # if present
    hex = hex.replace(/^#/, '');
    
    // Validate hex format (3 or 6 characters, valid hex digits)
    if (!/^([0-9A-Fa-f]{3}){1,2}$/.test(hex)) {
        throw new Error('Invalid hex color format');
    }
    
    // Expand 3-digit hex to 6-digit
    if (hex.length === 3) {
        hex = hex.split('').map(char => char + char).join('');
    }
    
    // Parse the hex values
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    
    return { r, g, b };
}