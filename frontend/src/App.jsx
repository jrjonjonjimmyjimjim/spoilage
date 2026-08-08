import { useState } from 'react';
import Inventory from './page/Inventory/Inventory';
import Constants from './Constants';

export default function App() {
	const [activePage, setActivePage] = useState(Constants.Page.INVENTORY);

	return (
		<>
			<div className='min-h-screen bg-hero bg-cover bg-center bg-fixed'>
				<div className='flex bg-purple-200/80 rounded-md m-auto max-w-6xl h-lg p-2'>
					<div className='text-5xl'>Spoilage</div>
					<div className='flex-1'>
						<div className='m-auto grid grid-cols-2 bg-white/60 rounded-md w-sm h-full p-1'>
							<div
								className={`text-2xl text-center mt-auto mb-auto rounded-md hover:font-bold cursor-pointer ${activePage === Constants.Page.INVENTORY ? 'bg-white font-bold' : ''}`}
								onClick={() => setActivePage(Constants.Page.INVENTORY)}
							>
								Inventory
							</div>
							<div
								className={`text-2xl text-center mt-auto mb-auto rounded-md hover:font-bold cursor-pointer ${activePage !== Constants.Page.INVENTORY ? 'bg-white font-bold' : ''}`}
								onClick={() => setActivePage(Constants.Page.SHOPPING_LISTS)}
							>
								Shopping
							</div>
						</div>
					</div>
					<div className='text-3xl'>user.name</div>
				</div>
				{activePage === Constants.Page.INVENTORY && <Inventory />}
			</div >
		</>
	);
}
