import { escapeSvelte } from 'mdsvex';
import { createHighlighter } from 'shiki';

const languages = { bash: 'bash', html: 'html', javascript: 'javascript', js: 'javascript', json: 'json', ts: 'typescript', typescript: 'typescript' };
const labels = { bash: 'Shell', html: 'HTML', javascript: 'JavaScript', js: 'JavaScript', json: 'JSON', ts: 'TypeScript', typescript: 'TypeScript' };
let highlighterPromise;

function getHighlighter() {
	highlighterPromise ??= createHighlighter({ langs: [...new Set(Object.values(languages))], themes: ['gruvbox-light-hard', 'gruvbox-dark-hard'] });
	return highlighterPromise;
}

export default {
	extensions: ['.md'],
	highlight: {
		async highlighter(code, language = 'text', metastring = '') {
			const highlighter = await getHighlighter();
			const html = highlighter.codeToHtml(code, { lang: languages[language] ?? 'text', themes: { light: 'gruvbox-light-hard', dark: 'gruvbox-dark-hard' }, defaultColor: false });
			const preview = /show-preview=on/.test(metastring) ? ' show-preview="on"' : '';
			return `{@html \`${escapeSvelte(`<zbk-code-block label="${labels[language] ?? 'Code'}" split-control="off"${preview}>${html}</zbk-code-block>`)}\`}`;
		}
	}
};
