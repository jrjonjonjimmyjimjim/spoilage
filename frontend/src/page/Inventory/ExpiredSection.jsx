import * as _ from 'lodash-es';
import ExpiredSectionItem from "./ExpiredSectionItem";

export default function ExpiredSection({ items }) {

	return (
		<>
			<h2 className="text-2xl">Expired</h2>
			<div className="flex flex-col gap-1 border rounded-lg p-2 bg-red-200">
				{_.map(items, (item) => <ExpiredSectionItem item={item} key={item.item_id} />)}
			</div>
		</>
	);
}
