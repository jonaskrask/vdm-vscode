package tempo.vdm;

import java.io.InputStream;
import java.lang.reflect.Type;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Set;

import org.overture.interpreter.values.CharacterValue;
import org.overture.interpreter.values.MapValue;
import org.overture.interpreter.values.NaturalOneValue;
import org.overture.interpreter.values.SeqValue;
import org.overture.interpreter.values.SetValue;
import org.overture.interpreter.values.Value;

import com.google.gson.GsonBuilder;
import com.google.gson.JsonDeserializationContext;
import com.google.gson.JsonDeserializer;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParseException;

import nl.west.rme.common.util.Streams;
import nl.west.rme.common.util.Text;

public class RoadIO {
	public static class World {
		public Map<Integer, Node> id2node;
		public Map<Integer, Edge> id2edge;

		@Override
		public String toString() {
			return "World[nodes=" + id2node.values() + ", edges=" + id2edge.values() + "]";
		}
	}

	public static class Node {
		public final int id;

		public Node(int id) {
			this.id = id;
		}

		@Override
		public String toString() {
			return "Node#" + id;
		}
	}

	public static class Edge {
		public final int id;
		public final Node src, dst;

		public int length;
		public int speedLimit;
		public int capacity;

		public Edge(int id, Node src, Node dst) {
			if (src == null)
				throw new NullPointerException();
			if (dst == null)
				throw new NullPointerException();
			this.id = id;
			this.src = src;
			this.dst = dst;
		}

		@Override
		public String toString() {
			return "Edge#" + id + "[" + src.id + " --> " + dst.id + "]";
		}
	}

	private Set<Integer> nodeIds;
	private Map<Integer, List<Integer>> edge2srcAndDst;
	private Map<Integer, Integer> edge2length;
	private Map<Integer, Integer> edge2speedLimit;
	private Map<Integer, Integer> edge2capacity;

	private class WorldDeserializer implements JsonDeserializer<World> {
		private final World world;

		public WorldDeserializer(World world) {
			this.world = world;
		}

		@Override
		public World deserialize(JsonElement elem, Type type, JsonDeserializationContext context)
				throws JsonParseException {
			JsonObject obj = (JsonObject) elem;

			world.id2node = new HashMap<>();
			for (JsonElement item : obj.getAsJsonArray("nodes")) {
				Node node = context.deserialize(item, Node.class);
				if (world.id2node.put(node.id, node) != null) {
					throw new IllegalStateException("duplicate " + node);
				}
			}

			world.id2edge = new HashMap<>();
			for (JsonElement item : obj.getAsJsonArray("edges")) {
				Edge edge = context.deserialize(item, Edge.class);
				if (world.id2edge.put(edge.id, edge) != null) {
					throw new IllegalStateException("duplicate " + edge);
				}
			}

			return world;
		}
	}

	private class NodeDeserializer implements JsonDeserializer<Node> {
		@Override
		public Node deserialize(JsonElement elem, Type type, JsonDeserializationContext context)
				throws JsonParseException {
			JsonObject obj = (JsonObject) elem;
			Node node = new Node(obj.get("id").getAsInt());
			return node;
		}
	}

	private class EdgeDeserializer implements JsonDeserializer<Edge> {
		private final World world;

		public EdgeDeserializer(World world) {
			this.world = world;
		}

		@Override
		public Edge deserialize(JsonElement elem, Type type, JsonDeserializationContext context)
				throws JsonParseException {
			JsonObject obj = (JsonObject) elem;

			int id = obj.get("id").getAsInt();
			int srcNodeId = obj.get("src").getAsInt();
			int dstNodeId = obj.get("dst").getAsInt();
			Node srcNode = world.id2node.get(srcNodeId);
			Node dstNode = world.id2node.get(dstNodeId);

			Edge edge = new Edge(id, srcNode, dstNode);
			edge.length = obj.get("length").getAsInt();
			edge.speedLimit = obj.get("speedLimit").getAsInt();
			edge.capacity = obj.get("capacity").getAsInt();
			return edge;
		}
	}

	public Value load(Value pathValue) {
		try {
			String path = fromCharSeq((SeqValue) pathValue);
			System.out.println("Loading data from path: '" + path + "'");

			World world = new World();

			GsonBuilder gson = new GsonBuilder();
			gson.registerTypeAdapter(World.class, new WorldDeserializer(world));
			gson.registerTypeAdapter(Edge.class, new EdgeDeserializer(world));
			gson.registerTypeAdapter(Node.class, new NodeDeserializer());

			InputStream in = RoadIO.class.getResourceAsStream(path);
			String json = Text.utf8(Streams.readFully(in));
			gson.create().fromJson(json, World.class);

			// convert objects to data structures of primitives

			nodeIds = new HashSet<>();
			edge2srcAndDst = new HashMap<>();
			edge2length = new HashMap<>();
			edge2speedLimit = new HashMap<>();
			edge2capacity = new HashMap<>();

			for (Node node : world.id2node.values()) {
				nodeIds.add(node.id);
			}

			for (Edge edge : world.id2edge.values()) {
				edge2srcAndDst.put(edge.id, Arrays.asList(edge.src.id, edge.dst.id));
				edge2length.put(edge.id, edge.length);
				edge2speedLimit.put(edge.id, edge.speedLimit);
				edge2capacity.put(edge.id, edge.capacity);
			}

			assert edge2srcAndDst.size() == edge2length.size();
			assert edge2srcAndDst.size() == edge2speedLimit.size();
			assert edge2srcAndDst.size() == edge2capacity.size();

			// return dummy value
			return toNat1(1);
		} catch (Exception e) {
			e.printStackTrace(System.out);

			throw new IllegalStateException(e);
		}
	}

	public Value getNodeIds() {
		if (nodeIds == null)
			throw new IllegalStateException();
		return toNat1Set(nodeIds);
	}

	public Value getEdgeIdSrcAndDsts() {
		if (nodeIds == null)
			throw new IllegalStateException();
		return toNat1Nat1sMap(edge2srcAndDst);
	}

	public Value getEdgeIdLengths() {
		if (edge2length == null)
			throw new IllegalStateException();
		return toNat1Nat1Map(edge2length);
	}

	public Value getEdgeIdSpeedLimits() {
		if (edge2speedLimit == null)
			throw new IllegalStateException();
		return toNat1Nat1Map(edge2speedLimit);
	}

	public Value getEdgeIdCapacities() {
		if (edge2capacity == null)
			throw new IllegalStateException();
		return toNat1Nat1Map(edge2capacity);
	}

	//

	private static String fromCharSeq(SeqValue seq) {
		StringBuilder sb = new StringBuilder();
		for (Value item : seq.values) {
			sb.append(((CharacterValue) item).unicode);
		}
		return sb.toString();
	}

	private static SeqValue toCharSeq(String text) {
		SeqValue seq = new SeqValue();
		for (char chr : text.toCharArray())
			seq.values.add(new CharacterValue(chr));
		return seq;
	}

	//

	private static SetValue toNat1Set(Set<Integer> values) {
		SetValue set = new SetValue();
		for (Integer value : values) {
			set.values.add(toNat1(value.intValue()));
		}
		return set;
	}

	//

	private static SeqValue toNat1Seq(List<Integer> values) {
		SeqValue seq = new SeqValue();
		for (Integer value : values) {
			seq.values.add(toNat1(value.intValue()));
		}
		return seq;
	}

	//

	private static MapValue toNat1Nat1Map(Map<Integer, Integer> mapping) {
		MapValue map = new MapValue();
		for (Entry<Integer, Integer> entry : mapping.entrySet()) {
			map.values.put(toNat1(entry.getKey().intValue()), toNat1(entry.getValue().intValue()));
		}
		return map;
	}

	private static MapValue toNat1Nat1sMap(Map<Integer, List<Integer>> mapping) {
		MapValue map = new MapValue();
		for (Entry<Integer, List<Integer>> entry : mapping.entrySet()) {
			map.values.put(toNat1(entry.getKey().intValue()), toNat1Seq(entry.getValue()));
		}
		return map;
	}

	//

	private static NaturalOneValue toNat1(long v) {
		try {
			return new NaturalOneValue(v);
		} catch (Exception e) {
			throw new IllegalArgumentException(e);
		}
	}
}