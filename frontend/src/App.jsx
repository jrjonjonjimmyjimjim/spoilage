import { useState } from 'react';
import Inventory from './page/Inventory/Inventory';

export default function App() {
	const [count, setCount] = useState(0);

	return (
		<Inventory />
	);
}
