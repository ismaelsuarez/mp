window.addEventListener('DOMContentLoaded', () => {
	const saveBtn = document.getElementById('saveBtn');
	const keyInput = document.getElementById('key');
	const valueInput = document.getElementById('value');
	const output = document.getElementById('output');

	const render = () => {
		const all = window.api.readAll();
		output.textContent = JSON.stringify(all, null, 2);
	};

	saveBtn.addEventListener('click', () => {
		const key = keyInput.value || 'test.key';
		const value = valueInput.value || 'hola-mp';
		window.api.save(key, value);
		render();
	});

	render();
});


