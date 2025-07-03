import { getJotformStructure } from './jotform-parser.js';
import { parseQueryParameters, applyDataToForm } from './form-modifier.js';

/**
 * 外部スクリプトを読み込み、完了を待つPromiseを返す
 * @param src スクリプトのURL
 */
function loadExternalScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.body.appendChild(script);
    });
}

/**
 * インラインスクリプトのコードを安全に実行する
 * @param code 実行するJavaScriptコード
 */
function executeInlineScript(code: string) {
    try {
        // new Function()を使うことで、グローバルスコープでコードを実行する
        new Function(code)();
    } catch (e) {
        console.warn('Error executing inline script:', e);
    }
}

/**
 * 複数のscript要素を順番に、かつ正しく実行する
 * @param scriptElements 実行対象のscript要素の配列
 */
async function executeScriptsSequentially(scriptElements: HTMLScriptElement[]) {
    for (const script of scriptElements) {
        if (script.src && !script.defer) {
            try {
                await loadExternalScript(script.src);
            } catch (error) {
                console.error(error);
            }
        } else if (script.textContent) {
            executeInlineScript(script.textContent);
        }
    }
    for (const script of scriptElements) {
        if (script.src && script.defer) {
             try {
                await loadExternalScript(script.src);
            } catch (error) {
                console.error(error);
            }
        }
    }
}

/**
 * メインの実行処理
 */
async function initializeForm() {
    try {
        // ★★★ 修正点: jotform.htmlへのパスをルートからの絶対パスに変更 ★★★
        const response = await fetch('/jotform.html');
        if (!response.ok) {
            throw new Error(`Failed to fetch jotform.html: ${response.statusText}`);
        }
        const html = await response.text();

        const parser = new DOMParser();
        const jotformDoc = parser.parseFromString(html, 'text/html');

        jotformDoc.querySelectorAll('head > style, head > link[rel="stylesheet"]').forEach(styleEl => {
            document.head.appendChild(styleEl.cloneNode(true));
        });

        const container = document.getElementById('jotform-container');
        if (!container) {
            throw new Error('Container #jotform-container not found.');
        }
        container.innerHTML = jotformDoc.body.innerHTML;
        
        const scriptsToLoad = Array.from(jotformDoc.querySelectorAll<HTMLScriptElement>('script'));
        await executeScriptsSequentially(scriptsToLoad);

        console.log('All Jotform scripts loaded and executed successfully.');
        
        setTimeout(() => {
            if (document.querySelector('form.jotform-form')) {
                const queryData = parseQueryParameters();
                const formStructure = getJotformStructure();

                applyDataToForm(formStructure.fieldGroups, queryData);
                
                if (queryData) {
                    console.log("Form data applied from query parameters.");
                } else {
                    console.log("No query data found. Applied default view settings.");
                }
                console.log("Parsed Jotform Structure:", formStructure);
            }
        }, 200);

    } catch (error) {
        console.error('Error during form initialization:', error);
    }
}

document.addEventListener('DOMContentLoaded', initializeForm);
