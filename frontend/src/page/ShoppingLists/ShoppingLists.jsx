import * as _ from 'lodash-es';
import { useQuery } from '@tanstack/react-query';
import ShoppingListSection from './ShoppingListSection';

import { X } from 'lucide-react';

export default function ShoppingLists() {
	const { data, isLoading, error } = useQuery({
		queryKey: ['shopping_lists_summary'],
		queryFn: () => fetch('/api/shopping_lists_summary').then(res => res.json()),
	});
	const items = _.get(data, 'items');

	const itemsGroupedByListName = _.groupBy(items, 'list_name');

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

				{_.map(itemsGroupedByListName, (items, list_name) => <ShoppingListSection listName={list_name} items={items} key={category} />)}
			</div>
		</>
	);
}
