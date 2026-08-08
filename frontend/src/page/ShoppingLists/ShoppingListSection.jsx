import * as _ from 'lodash-es';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import ShoppingListSectionItem from './ShoppingListSectionItem';
import ShoppingListSectionNewItem from './ShoppingListSectionNewItem';

export default function ShoppingListSection({ listName, items }) {
	const [newItemFormOpen, setNewItemFormOpen] = useState(false);
	const queryClient = useQueryClient();

	const mutationPut = useMutation({
		mutationFn: ({ oldListName, newListName }) => fetch('/api/shopping_lists_list_name', {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ oldListName, newListName }),
		}),
		onMutate: async ({ oldListName, newListName }) => {
			await queryClient.cancelQueries({ queryKey: ['shopping_lists_summary'] });
			const previousShoppingLists = queryClient.getQueryData(['shopping_lists_summary']);
			queryClient.setQueryData(['shopping_lists_summary'], (oldShoppingLists) => ({
				...oldShoppingLists,
				items: _.map(oldShoppingLists.items,
					(oldItem) => oldItem.list_name === oldListName ? { ...oldItem, list_name: newListName } : oldItem
				),
			}));
			return { previousShoppingLists };
		},
		onError: (err, { oldListName, newListName }, context) => {
			queryClient.setQueryData(['shopping_lists_summary'], context.previousShoppingLists);
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ['shopping_lists_summary'] });
		},
	});

	const mutationClearPost = useMutation({
		mutationFn: ({ listName }) => fetch('/api/shopping_lists_list_clear', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ listName }),
		}),
		onMutate: async ({ listName }) => {
			await queryClient.cancelQueries({ queryKey: ['shopping_lists_summary'] });
			const previousShoppingLists = queryClient.getQueryData(['shopping_lists_summary']);
			queryClient.setQueryData(['shopping_lists_summary'], (oldShoppingLists) => ({
				...oldShoppingLists,
				items: _.filter(oldShoppingLists.items, (oldItem) => oldItem.list_name !== listName || !oldItem.is_grabbed),
			}));
			return { previousShoppingLists };
		},
		onError: (err, { oldListName, newListName }, context) => {
			queryClient.setQueryData(['shopping_lists_summary'], context.previousShoppingLists);
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ['shopping_lists_summary'] });
		},
	});

	const grabbedItems = _.filter(items, { is_grabbed: true });

	return (
		<>
			<label htmlFor={`list-name-input-${listName}`} className='sr-only'>
				Edit list name {listName}
			</label>
			<input
				id={`list-name-input-${listName}`}
				type='text'
				className='flex-1 bg-white/70 transition duration-100 ease-in-out hover:bg-blue-100 border rounded-sm pl-1'
				title='Click to change this list&#39;s name'
				defaultValue={listName}
				onBlur={(event) => {
					if (event.target.value !== listName) {
						mutationPut.mutate({ oldListName: listName, newListName: event.target.value });
					}
				}}
			/>
			<h2 className='text-2xl'>{listName}</h2>
			<div className='flex flex-col gap-1 border rounded-lg p-2 bg-taupe-200'>
				{!newItemFormOpen &&
					<>
						<button
							className='w-48 bg-white/70 transition duration-100 ease-in-out hover:bg-blue-100 border rounded-sm pl-1'
							title='Add a new item to this list'
							onClick={() => setNewItemFormOpen(true)}>
							Add new
						</button>
						<button
							className='w-48 bg-white/70 transition duration-100 ease-in-out hover:bg-blue-100 border rounded-sm pl-1'
							title='Remove all grabbed items from this list'
							onClick={() => {
								if (_.some(grabbedItems)) {
									mutationClearPost.mutate({ listName });
								}
							}}>
							Clear list
						</button>
					</>
				}
				{newItemFormOpen &&
					<ShoppingListSectionNewItem setNewItemFormOpen={setNewItemFormOpen} listName={listName} />
				}
				{_.map(items, (item) => <ShoppingListSectionItem item={item} key={item.item_id} />)}
			</div>
		</>
	);
}
