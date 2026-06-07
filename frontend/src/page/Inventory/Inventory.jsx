import * as _ from 'lodash-es';
import { useQuery } from '@tanstack/react-query';
import ExpiredSection from './ExpiredSection';

import { X } from 'lucide-react';

export default function Inventory() {
	const { data, isLoading, error } = useQuery({
		queryKey: ['inventory'],
		queryFn: () => fetch('/api/summary').then(res => res.json()),
	});
	const items = _.get(data, 'items');

	const expiredItems = _.filter(items, (item) => item.days_till_expiration < 0);
	const edibleItemsGroupedByCategory = _.chain(items)
		.filter((item) => item.days_till_expiration >= 0)
		.groupBy('category')
		.value();

	return (
		<>
			{error &&
				<div>
					<X className="inline text-red-500" />
					<p className="inline">
						You are offline. Changes may not sync properly.
					</p>
				</div>
			}

			<ExpiredSection items={expiredItems} />
			{/* {_.forEach(edibleItemsGroupedByCategory, (items, category) => <InventorySection category={category} items={items} />)} */}
		</>
	);
}
