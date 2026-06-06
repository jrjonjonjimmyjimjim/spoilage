import { useState } from 'react';

export default function App() {
	const [count, setCount] = useState(0);

	return (
		<div class="flex flex-col items-center justify-center min-h-screen space-y-4">
			<div class="p-6 max-w-sm bg-white rounded-xl shadow-lg border border-gray-200 text-center">
				<h1 class="text-2xl font-bold text-indigo-600 mb-2">Hello world!</h1>
				<p class="text-gray-500 mb-4">
					Whoopdie doo looks like it works
				</p>
				<button
					onClick={() => setCount(count + 1)}
					class="px-4 py-2 bg-indigo-600 hover.bg-indigo-700 text-white font-semibold rounded-lg shadow transition duration-200 cursor-pointer">
					State Test Count: {count}
				</button>
			</div>
		</div>
	);
}
