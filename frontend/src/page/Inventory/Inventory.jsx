import * as _ from 'lodash-es';
import { useQuery } from '@tanstack/react-query';
import ExpiredSection from './ExpiredSection';
import InventorySection from './InventorySection';

import { X } from 'lucide-react';

export default function Inventory() {
	const { data, isLoading, error } = useQuery({
		queryKey: ['inventory_summary'],
		queryFn: () => fetch('/api/inventory_summary').then(res => res.json()),
	});
	const items = _.get(data, 'items');

	const expiredItems = _.filter(items, (item) => item.days_till_expiration < 0);
	const edibleItemsGroupedByCategory = _.chain(items)
		.filter((item) => item.days_till_expiration >= 0)
		.groupBy('category')
		.value();

	return (
		<>
			<div className='min-h-screen max-w-4xl m-auto p-2 bg-gray-200/80 border rounded-2xl'>
				{error &&
					<div>
						<X className='inline text-red-500' />
						<p className='inline'>
							You are offline. Changes may not sync properly.
						</p>
					</div>
				}

				{_.some(expiredItems) && <ExpiredSection items={expiredItems} />}
				{_.map(edibleItemsGroupedByCategory, (items, category) => <InventorySection category={category} items={items} key={category} />)}
			</div>
		</>
	);
}
