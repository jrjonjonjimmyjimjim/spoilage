import * as _ from 'lodash-es';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Check, X } from 'lucide-react';

export default function ShoppingListSectionNewItem({ setNewItemFormOpen, listName }) {
	const [newItemName, setNewItemName] = useState('');
	const [newItemAisle, setNewItemAisle] = useState('');
	const [newItemQuantity, setNewItemQuantity] = useState('');
	const queryClient = useQueryClient();

	const mutationPost = useMutation({
		mutationFn: ({ newItem }) => fetch('/api/shopping_lists_item', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ ...newItem }),
		}),
		onMutate: async ({ newItem }) => {
			await queryClient.cancelQueries({ queryKey: ['shopping_lists_summary'] });
			const previousShoppingLists = queryClient.getQueryData(['shopping_lists_summary']);
			queryClient.setQueryData(['shopping_lists_summary'], (oldShoppingLists) => ({
				...oldShoppingLists,
				items: [...oldShoppingLists.items, newItem],
			}));
			return { previousShoppingLists };
		},
		onError: (err, { newItem }, context) => {
			queryClient.setQueryData(['shopping_lists_summary'], context.previousShoppingLists);
			setNewItemFormOpen(true);
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ['shopping_lists_summary'] });
		},
	});

	return (
		<>
			<form className='flex flex-wrap gap-4 bg-green-400/30 p-1 rounded-md' onSubmit={(event) => {
				event.preventDefault();
				mutationPost.mutate({ newItem: { item_name: newItemName, item_aisle: newItemAisle, item_quantity: newItemQuantity, list_name: listName } });
				setNewItemFormOpen(false);
			}}>
				<label htmlFor='item-name-input-new' className='sr-only'>
					New item name
				</label>
				<input
					id='item-name-input-new'
					type='text'
					required
					className='flex-1 bg-white/70 transition duration-100 ease-in-out hover:bg-blue-100 border rounded-sm pl-1'
					title='Click to set your new item&#39;s name'
					value={newItemName}
					onChange={(event) => {
						setNewItemName(event.target.value);
					}}
				/>
				<label htmlFor='aisle-input-new' className=''>
					Aisle
				</label>
				<input
					id='aisle-input-new'
					type='text'
					className='flex-none bg-white/70 transition duration-100 ease-in-out hover:bg-blue-100 border rounded-sm'
					title='Click to set the aisle this item is located in'
					value={newItemAisle}
					onChange={(event) => {
						setNewItemAisle(event.target.value);
					}}
				/>
				<label htmlFor='quantity-input-new' className=''>
					Qty
				</label>
				<input
					id='quantity-input-new'
					type='text'
					className='flex-none bg-white/70 transition duration-100 ease-in-out hover:bg-blue-100 border rounded-sm'
					title='Click to set the quantity for this item'
					value={newItemQuantity}
					onChange={(event) => {
						setNewItemQuantity(event.target.value);
					}}
				/>
				<button
					className='bg-green-500 transition duration-100 ease-in-out hover:bg-green-600 border rounded-sm ml-auto'
					title='Save this new item'
					type='submit'
				>
					<Check />
				</button>
				<button
					className='bg-red-400 transition duration-100 ease-in-out hover:bg-red-600 border rounded-sm ml-auto'
					title='Close new item form'
					onClick={() => {
						setNewItemFormOpen(false);
					}}>
					<X />
				</button>
			</form>
		</>
	);
}
