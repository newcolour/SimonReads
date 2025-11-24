

export const parseOpml = async (file: File): Promise<string[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const parser = new DOMParser();
                const xml = parser.parseFromString(text, 'text/xml');

                const outlines = xml.querySelectorAll('outline[xmlUrl]');
                const urls: string[] = [];

                outlines.forEach(outline => {
                    const url = outline.getAttribute('xmlUrl');
                    if (url) {
                        urls.push(url);
                    }
                });

                resolve(urls);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsText(file);
    });
};
