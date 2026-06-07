import * as _ from 'lodash-es';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { X } from 'lucide-react';

export default function ExpiredSectionItem({ item }) {
	const [expiresPostponeSelectValue, setExpiresPostponeSelectValue] = useState('NONE');
	const queryClient = useQueryClient();

	const mutationPut = useMutation({
		mutationFn: (updatedItem) => fetch('/api/item', {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ ...updatedItem }),
		}),
		onMutate: async (updatedItem) => {
			await queryClient.cancelQueries({ queryKey: ['inventory'] });
			const previousInventory = queryClient.getQueryData(['inventory']);
			queryClient.setQueryData(['inventory'], (oldInventory) => {
				return _.map(oldInventory,
					(oldItem) => oldItem.item_id === updatedItem.item_id ? { ...oldItem, item_name: updatedItem.item_name } : oldItem
				);
			});
			return { previousInventory };
		},
		onError: (err, updatedItem, context) => {
			queryClient.setQueryData(['inventory'], context.previousInventory);
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ['inventory'] });
		},
	});

	const mutationDelete = useMutation({
		mutationFn: (itemToDelete) => fetch('/api/item', {
			method: 'DELETE',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ ...itemToDelete }),
		}),
		onMutate: async (itemToDelete) => {
			await queryClient.cancelQueries({ queryKey: ['inventory'] });
			const previousInventory = queryClient.getQueryData(['inventory']);
			queryClient.setQueryData(['inventory'], (oldInventory) => {
				return _.filter(oldInventory, (oldItem) => oldItem.item_id !== itemToDelete.item_id);
			});
			return { previousInventory };
		},
		onError: (err, itemToDelete, context) => {
			queryClient.setQueryData(['inventory'], context.previousInventory);
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ['inventory'] });
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

	return (
		<>
			<div className="flex bg-red-200">
				<label htmlFor={`item-name-input-${item.item_id}`} className='sr-only'>
					Edit item {item.item_name}
				</label>
				<input
					id={`item-name-input-${item.item_id}`}
					type="text"
					defaultValue={item.item_name}
					onBlur={(event) => {
						if (event.target.value !== item.item_name) {
							mutationPut.mutate({ ...item, item_name: event.target.value });
						}
					}}
				/>
				<p>{expirationMessage}</p>
				<label htmlFor={`expires-input-${item.item_id}`} className='sr-only'>
					Expiration date for item {item.item_name}
				</label>
				<input
					id={`expires-input-${item.item_id}`}
					type="date"
					defaultValue={item.expires}
					onBlur={(event) => {
						if (event.target.value !== item.expires) {
							mutationPut.mutate({ ...item, expires: event.target.value });
						}
					}}
				/>
				<label htmlFor={`expires-postpone-select-${item.item_id}`} className='sr-only'>
					Select a number of days from today to reset this expiration date to
				</label>
				<select
					id={`expires-postpone-select-${item.item_id}`}
					value={expiresPostponeSelectValue}
					onChange={(event) => {
						const postponeAmount = event.target.value;
						if (postponeAmount === 'NONE') return;

						// TODO: Add postpone date calc logic
						setExpiresPostponeSelectValue('NONE');
					}}
				>
					<option value="NONE">Add days</option>
					<option value="1">1 days</option>
					<option value="3">3 days</option>
					<option value="5">5 days</option>
					<option value="7">1 week</option>
					<option value="14">2 weeks</option>
					<option value="21">3 weeks</option>
					<option value="28">4 weeks</option>
					<option value="90">3 months</option>
					<option value="365">1 year</option>
				</select>
				<button onClick={() => mutationDelete.mutate(item)}>
					<X />
				</button>
			</div>
		</>
	);
}
