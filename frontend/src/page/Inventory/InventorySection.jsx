import * as _ from 'lodash-es';
import { useState } from 'react';
import InventorySectionItem from './InventorySectionItem';
import InventorySectionNewItem from './InventorySectionNewItem';

export default function InventorySection({ category, items }) {
	const [newItemFormOpen, setNewItemFormOpen] = useState(false);

	return (
		<>
			<h2 className='text-2xl'>{category}</h2>
			<div className='flex flex-col gap-1 border rounded-lg p-2 bg-taupe-200'>
				{!newItemFormOpen &&
					<button
						className='w-48 bg-white/70 transition duration-100 ease-in-out hover:bg-blue-100 border rounded-sm pl-1'
						title='Add a new item to this category'
						onClick={() => setNewItemFormOpen(true)}>
						Add new
					</button>
				}
				{newItemFormOpen &&
					<InventorySectionNewItem setNewItemFormOpen={setNewItemFormOpen} />
				}
				{_.map(items, (item) => <InventorySectionItem item={item} key={item.item_id} />)}
			</div>
		</>
	);
}
