import * as _ from 'lodash-es';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { X } from 'lucide-react';

export default function InventorySectionItem({ item }) {
	const [expiresPostponeSelectValue, setExpiresPostponeSelectValue] = useState('NONE');
	const queryClient = useQueryClient();

	const mutationPut = useMutation({
		mutationFn: (updatedItem) => fetch('/api/inventory_item', {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ ...updatedItem }),
		}),
		onMutate: async (updatedItem) => {
			await queryClient.cancelQueries({ queryKey: ['inventory_summary'] });
			const previousInventory = queryClient.getQueryData(['inventory_summary']);
			queryClient.setQueryData(['inventory_summary'], (oldInventory) => ({
				...oldInventory,
				items: _.map(oldInventory.items,
					(oldItem) => oldItem.item_id === updatedItem.item_id ? { ...oldItem, item_name: updatedItem.item_name } : oldItem
				),
			}));
			return { previousInventory };
		},
		onError: (err, updatedItem, context) => {
			queryClient.setQueryData(['inventory_summary'], context.previousInventory);
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ['inventory_summary'] });
		},
	});

	const mutationDelete = useMutation({
		mutationFn: (itemToDelete) => fetch('/api/inventory_item', {
			method: 'DELETE',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ ...itemToDelete }),
		}),
		onMutate: async (itemToDelete) => {
			await queryClient.cancelQueries({ queryKey: ['inventory_summary'] });
			const previousInventory = queryClient.getQueryData(['inventory_summary']);
			queryClient.setQueryData(['inventory_summary'], (oldInventory) => ({
				...oldInventory,
				items: _.filter(oldInventory.items, (oldItem) => oldItem.item_id !== itemToDelete.item_id),
			}));
			return { previousInventory };
		},
		onError: (err, itemToDelete, context) => {
			queryClient.setQueryData(['inventory_summary'], context.previousInventory);
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ['inventory_summary'] });
		},
	});

	let expirationMessage;
	if (item.days_till_expiration <= -2) {
		expirationMessage = `${item.days_till_expiration * -1} days ago`;
	} else if (item.days_till_expiration === -1) {
		expirationMessage = `Yesterday`;
	} else if (item.days_till_expiration === 0) {
		expirationMessage = `Today`;
	} else if (item.days_till_expiration === 1) {
		expirationMessage = `Tomorrow`;
	} else if (item.days_till_expiration <= 30) {
		expirationMessage = `In ${item.days_till_expiration} days`;
	} else if (item.days_till_expiration <= 60) {
		expirationMessage = `In 1 month`;
	} else if (item.days_till_expiration <= 365) {
		expirationMessage = `In ${Math.floor(item.days_till_expiration / 30)} months`;
	} else if (item.days_till_expiration <= 730) {
		expirationMessage = `In 1 year`;
	} else {
		expirationMessage = `In ${Math.floor(item.days_till_expiration / 365)} years`;
	}

	const postponeExclamation = _.repeat('!', Math.min(item.postpone_count, 3));

	return (
		<>
			<div className='flex flex-wrap gap-4 bg-yellow-200 p-1 rounded-md'>
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
							mutationPut.mutate({ ...item, item_name: event.target.value });
						}
					}}
				/>
				<p
					className='flex-none'
					title={`This item will expire ${expirationMessage}`}
				>
					{expirationMessage}
				</p>
				<p
					className='w-4 flex-none text-center text-xl font-bold'
					title={item.postpone_count ? `This item's expiration date has already been postponed ${item.postpone_count} time(s)` : ``}
				>
					{postponeExclamation}
				</p>
				<label htmlFor={`expires-input-${item.item_id}`} className='sr-only'>
					Expiration date for item {item.item_name}
				</label>
				<input
					id={`expires-input-${item.item_id}`}
					type='date'
					className='flex-none bg-white/70 transition duration-100 ease-in-out hover:bg-blue-100 border rounded-sm'
					title='Click to change this item&#39;s expiration date'
					defaultValue={item.expires}
					onBlur={(event) => {
						if (event.target.value !== item.expires) {
							mutationPut.mutate({ ...item, expires: event.target.value });
						}
					}}
				/>
				<label htmlFor={`expires-postpone-select-${item.item_id}`} className='sr-only bg-white/30'>
					Select a number of days from today to reset this expiration date to
				</label>
				<select
					id={`expires-postpone-select-${item.item_id}`}
					className='flex-none bg-white/70 transition duration-100 ease-in-out hover:bg-blue-100 border rounded-sm pl-1'
					title='Postpone: Select an option to push back the expiration date that many days further'
					value={expiresPostponeSelectValue}
					onChange={(event) => {
						const postponeAmount = event.target.value;
						if (postponeAmount === 'NONE') return;

						const [existingYear, existingMonth, existingDay] = _.split(item.expires, '-');
						const offsetDate = new Date(existingYear, existingMonth - 1, existingDay);
						offsetDate.setDate(offsetDate.getDate() + parseInt(postponeAmount));
						mutationPut.mutate({
							...item,
							postpone_by_days: parseInt(postponeAmount),
							expires: offsetDate.toISOString().split('T')[0],
							postpone_count: item.postpone_count + 1,
						});

						setExpiresPostponeSelectValue('NONE');
					}}
				>
					<option value='NONE'>Add</option>
					<option value='1'>1 day</option>
					<option value='3'>3 days</option>
					<option value='5'>5 days</option>
					<option value='7'>1 week</option>
					<option value='14'>2 weeks</option>
					<option value='21'>3 weeks</option>
					<option value='28'>4 weeks</option>
					<option value='90'>3 months</option>
					<option value='365'>1 year</option>
				</select>
				<button
					className='bg-red-400 transition duration-100 ease-in-out hover:bg-red-600 border rounded-sm ml-auto'
					title='Remove this item from your inventory'
					onClick={() => mutationDelete.mutate(item)}>
					<X />
				</button>
			</div>
		</>
	);
}
