
import React from 'react';

/**
 * Renders a subset of Markdown:
 * - **bold**
 * - * bullet / - bullet
 * - Blank lines become section breaks
 */
export const MarkdownText: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => {
    const lines = text.split('\n');

    const renderInline = (line: string, key: number): React.ReactNode => {
        // Tokenize: **bold**, [text](url), <url>
        const tokenRegex = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^\)]+)\)|<(https?:\/\/[^>]+)>/g;
        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        let match;

        while ((match = tokenRegex.exec(line)) !== null) {
            // Push plain text before match
            if (match.index > lastIndex) {
                parts.push(line.slice(lastIndex, match.index));
            }
            if (match[1]) {
                // **bold**
                parts.push(<strong key={match.index}>{match[1]}</strong>);
            } else if (match[2] && match[3]) {
                // [text](url)
                parts.push(<a key={match.index} href={match[3]} target="_blank" rel="noopener noreferrer" className="text-rose-600 underline hover:text-rose-800 break-all">{match[2]}</a>);
            } else if (match[4]) {
                // <url>
                parts.push(<a key={match.index} href={match[4]} target="_blank" rel="noopener noreferrer" className="text-rose-600 underline hover:text-rose-800 break-all">{match[4]}</a>);
            }
            lastIndex = match.index + match[0].length;
        }
        // Remaining text
        if (lastIndex < line.length) parts.push(line.slice(lastIndex));
        return parts;
    };

    const nodes: React.ReactNode[] = [];
    let bulletBuffer: string[] = [];

    const flushBullets = () => {
        if (bulletBuffer.length === 0) return;
        nodes.push(
            <ul key={`ul-${nodes.length}`} className="list-disc ml-5 my-2 space-y-1">
                {bulletBuffer.map((item, i) => (
                    <li key={i} className="leading-relaxed">{renderInline(item, i)}</li>
                ))}
            </ul>
        );
        bulletBuffer = [];
    };

    lines.forEach((line, idx) => {
        const trimmed = line.trim();

        if (/^[*\-]\s+/.test(trimmed)) {
            bulletBuffer.push(trimmed.replace(/^[*\-]\s+/, ''));
        } else {
            flushBullets();
            if (trimmed === '') {
                nodes.push(<div key={`br-${idx}`} className="mt-3" />);
            } else {
                nodes.push(
                    <p key={`p-${idx}`} className="leading-relaxed">
                        {renderInline(trimmed, idx)}
                    </p>
                );
            }
        }
    });
    flushBullets();

    return <div className={`space-y-1 text-sm ${className}`}>{nodes}</div>;
};
