import { useState } from 'react';
import Inventory from './page/Inventory/Inventory';

export default function App() {
	const [count, setCount] = useState(0);

	return (
		<div className='min-h-screen bg-hero bg-cover bg-center bg-fixed'>
			<Inventory />
		</div>
	);
}
