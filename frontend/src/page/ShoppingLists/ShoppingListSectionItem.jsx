import * as _ from 'lodash-es';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Check, Trash2, Undo } from 'lucide-react';

export default function ShoppingListSectionItem({ item }) {
	const queryClient = useQueryClient();

	const mutationPut = useMutation({
		mutationFn: ({ updatedItem }) => fetch('/api/shopping_lists_item', {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ ...updatedItem }),
		}),
		onMutate: async ({ updatedItem }) => {
			await queryClient.cancelQueries({ queryKey: ['shopping_lists_summary'] });
			const previousShoppingLists = queryClient.getQueryData(['shopping_lists_summary']);
			queryClient.setQueryData(['shopping_lists_summary'], (oldShoppingLists) => ({
				...oldShoppingLists,
				items: _.map(oldShoppingLists.items,
					(oldItem) => oldItem.item_id === updatedItem.item_id ? { ...oldItem, item_name: updatedItem.item_name } : oldItem
				),
			}));
			return { previousShoppingLists };
		},
		onError: (err, { updatedItem }, context) => {
			queryClient.setQueryData(['shopping_lists_summary'], context.previousShoppingLists);
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ['shopping_lists_summary'] });
		},
	});

	const mutationDelete = useMutation({
		mutationFn: ({ itemToDelete }) => fetch('/api/shopping_lists_item', {
			method: 'DELETE',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ ...itemToDelete }),
		}),
		onMutate: async ({ itemToDelete }) => {
			await queryClient.cancelQueries({ queryKey: ['shopping_lists_summary'] });
			const previousShoppingLists = queryClient.getQueryData(['shopping_lists_summary']);
			queryClient.setQueryData(['shopping_lists_summary'], (oldShoppingLists) => ({
				...oldShoppingLists,
				items: _.filter(oldShoppingLists.items, (oldItem) => oldItem.item_id !== itemToDelete.item_id),
			}));
			return { previousShoppingLists };
		},
		onError: (err, { itemToDelete }, context) => {
			queryClient.setQueryData(['shopping_lists_summary'], context.previousShoppingLists);
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ['shopping_lists_summary'] });
		},
	});

	return (
		<>
			<div className={`flex flex-wrap gap-4 p-1 rounded-md ${item.is_grabbed ? 'bg-green-200' : 'bg-yellow-200'}`}>
				<label htmlFor={`item-name-input-${item.item_id}`} className='sr-only'>
					Edit item {item.item_name}
				</label>
				<input
					id={`item-name-input-${item.item_id}`}
					type='text'
					className='flex-1 bg-white/70 transition duration-100 ease-in-out hover:bg-blue-100 border rounded-sm pl-1'
					title='Click to change this item&#39;s name'
					defaultValue={item.item_name}
					onBlur={(event) => {
						if (event.target.value !== item.item_name) {
							mutationPut.mutate({ updatedItem: { ...item, item_name: event.target.value } });
						}
					}}
				/>
				<label htmlFor={`aisle-input-${item.item_id}`} className=''>
					Aisle
				</label>
				<input
					id={`aisle-input-${item.item_id}`}
					type='text'
					className='flex-none bg-white/70 transition duration-100 ease-in-out hover:bg-blue-100 border rounded-sm'
					title='Click to set the aisle this item is located in'
					defaultValue={item.aisle}
					onBlur={(event) => {
						if (event.target.value !== item.aisle) {
							mutationPut.mutate({ updatedItem: { ...item, aisle: event.target.value } });
						}
					}}
				/>
				<label htmlFor={`quantity-input-${item.item_id}`} className=''>
					Qty
				</label>
				<input
					id={`quantity-input-${item.item_id}`}
					type='text'
					className='flex-none bg-white/70 transition duration-100 ease-in-out hover:bg-blue-100 border rounded-sm'
					title='Click to set the quantity for this item'
					defaultValue={item.quantity}
					onBlur={(event) => {
						if (event.target.value !== item.quantity) {
							mutationPut.mutate({ updatedItem: { ...item, quantity: event.target.value } });
						}
					}}
				/>
				{!item.is_grabbed &&
					<button
						className='bg-white/70 transition duration-100 ease-in-out hover:bg-blue-100 border rounded-sm ml-auto'
						title='Mark this item as grabbed'
						onClick={() => mutationPut.mutate({ updatedItem: { ...item, is_grabbed: true } })}>
						<Check />
					</button>
				}
				{item.is_grabbed &&
					<button
						className='bg-white/70 transition duration-100 ease-in-out hover:bg-blue-100 border rounded-sm ml-auto'
						title='Mark this item as NOT grabbed'
						onClick={() => mutationPut.mutate({ updatedItem: { ...item, is_grabbed: false } })}>
						<Undo />
					</button>
				}
				<button
					className='bg-red-400 transition duration-100 ease-in-out hover:bg-red-600 border rounded-sm ml-auto'
					title='Remove this item from your inventory'
					onClick={() => mutationDelete.mutate({ itemToDelete: item })}>
					<Trash2 />
				</button>
			</div>
		</>
	);
}
