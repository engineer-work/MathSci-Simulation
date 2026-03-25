
export const drawArrow = (ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number, color: string, label?: string, dashed: boolean = false, lineWidth: number = 2) => {
    const headlen = 10; 
    const dx = toX - fromX;
    const dy = toY - fromY;
    const angle = Math.atan2(dy, dx);
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length < 2) return;

    ctx.beginPath();
    if (dashed) ctx.setLineDash([5, 5]);
    else ctx.setLineDash([]);
    
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    
    ctx.beginPath();
    ctx.setLineDash([]);
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
    ctx.lineTo(toX, toY);
    ctx.fillStyle = color;
    ctx.fill();

    if (label) {
        ctx.fillStyle = color;
        ctx.font = '12px sans-serif';
        const midX = (fromX + toX) / 2;
        const midY = (fromY + toY) / 2;
        ctx.fillText(label, midX + 10, midY - 10);
    }
};

export const getStyles = () => {
    const style = getComputedStyle(document.body);
    return {
        bgColor: style.getPropertyValue('--bg-sidebar').trim(),
        accentColor: style.getPropertyValue('--accent-color').trim(),
        textColor: style.getPropertyValue('--text-main').trim(),
        mutedColor: style.getPropertyValue('--text-muted').trim(),
        borderColor: style.getPropertyValue('--border-color').trim()
    };
};
