import * as _ from 'lodash-es';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Check } from 'lucide-react';

export default function InventorySectionNewItem({ setNewItemFormOpen }) {
	const [newItemName, setNewItemName] = useState('');
	const [newItemExpires, setNewItemExpires] = useState('');
	const queryClient = useQueryClient();

	const mutationPost = useMutation({
		mutationFn: (newItem) => fetch('/api/item', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ ...newItem }),
		}),
		onMutate: async (newItem) => {
			setNewItemFormOpen(false);
			await queryClient.cancelQueries({ queryKey: ['inventory'] });
			const previousInventory = queryClient.getQueryData(['inventory']);
			queryClient.setQueryData(['inventory'], (oldInventory) => ({
				...oldInventory,
				items: [...oldInventory.items, newItem],
			}));
			return { previousInventory };
		},
		onError: (err, updatedItem, context) => {
			queryClient.setQueryData(['inventory'], context.previousInventory);
			setNewItemFormOpen(true);
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ['inventory'] });
		},
	});

	return (
		<>
			<div className='flex flex-wrap gap-4 bg-green-400/30 p-1 rounded-md'>
				<label htmlFor={`item-name-input-new`} className='sr-only'>
					New item name
				</label>
				<input
					id={`item-name-input-new`}
					type='text'
					className='flex-1 bg-white/70 transition duration-100 ease-in-out hover:bg-blue-100 border rounded-sm pl-1'
					title='Click to set your new item&#39;s name'
					value={newItemName}
					onChange={(event) => {
						setNewItemName(event.target.value);
					}}
				/>
				<label htmlFor={`expires-input-new`} className='sr-only'>
					Expiration date for item
				</label>
				<input
					id={`expires-input-new`}
					type='date'
					className='flex-none bg-white/70 transition duration-100 ease-in-out hover:bg-blue-100 border rounded-sm'
					title='Click to set this item&#39;s expiration date'
					value={newItemExpires}
					onChange={(event) => {
						setNewItemExpires(event.target.value);
					}}
				/>
				<button
					className='bg-green-500 transition duration-100 ease-in-out hover:bg-green-600 border rounded-sm ml-auto'
					title='Save this new item'
					onClick={() => mutationPost.mutate({ item_name: newItemName, expires: newItemExpires })}>
					<Check />
				</button>
			</div>
		</>
	);
}
